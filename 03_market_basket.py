"""
03_market_basket.py
===================
Runs a full Market Basket Analysis on the Dunnhumby transaction data
stored in retail.duckdb.

WHAT THIS PRODUCES
------------------
1. product_pairs.csv  — All product co-occurrence pairs with:
     • support        (% of baskets containing both products)
     • confidence_a→b (P(B | A purchased))
     • lift           (how much more often than random chance)

2. seasonal_lift.csv  — Same metrics but split by season so you can
   identify WHICH pairs spike in winter vs. summer → the weather trigger.

REQUIREMENTS
------------
    pip install duckdb pandas

USAGE
-----
    python 03_market_basket.py

PERFORMANCE NOTE
----------------
On the full 275K-basket dataset this runs in under 30 seconds locally
with DuckDB. If you're using the 50K-customer sample it will be instant.
"""

import duckdb
import pandas as pd
import os

DB_PATH      = "retail.duckdb"
OUTPUT_DIR   = "output"
MIN_SUPPORT  = 0.001   # Pair must appear in ≥ 0.1% of all baskets
MIN_LIFT     = 1.2     # Only keep pairs with meaningful lift

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Connect ───────────────────────────────────────────────────────────────────
con = duckdb.connect(DB_PATH, read_only=False)

print("\n" + "="*60)
print("  Market Basket Analysis — DuckDB")
print("="*60)

# ── Step 1: Total basket count ─────────────────────────────────────────────
print("\n[1/4] Counting baskets...")
total_baskets = con.execute("SELECT COUNT(DISTINCT basket_id) FROM transactions").fetchone()[0]
print(f"      Total baskets: {total_baskets:,}")

# ── Step 2: Product-level basket support ──────────────────────────────────
# How many baskets contain each product? (individual support)
print("\n[2/4] Computing individual product support...")
con.execute("""
    CREATE OR REPLACE TABLE product_support AS
    SELECT
        t.product_id,
        p.commodity_desc,
        p.department,
        COUNT(DISTINCT t.basket_id)                         AS basket_count,
        COUNT(DISTINCT t.basket_id) * 1.0 / {total}        AS support
    FROM transactions t
    JOIN products p ON t.product_id = p.product_id
    GROUP BY t.product_id, p.commodity_desc, p.department
    HAVING support >= {min_sup}
""".format(total=total_baskets, min_sup=MIN_SUPPORT))

n_products = con.execute("SELECT COUNT(*) FROM product_support").fetchone()[0]
print(f"      Products with sufficient support: {n_products:,}")

# ── Step 3: Co-occurrence pairs ────────────────────────────────────────────
# Self-join on basket_id where product_a < product_b (avoid duplicates)
print("\n[3/4] Computing product pair co-occurrences (this is the heavy step)...")

con.execute("""
    CREATE OR REPLACE TABLE product_pairs AS
    WITH eligible_products AS (
        SELECT product_id FROM product_support
    ),
    basket_items AS (
        SELECT DISTINCT basket_id, product_id
        FROM transactions
        WHERE product_id IN (SELECT product_id FROM eligible_products)
    ),
    pairs AS (
        SELECT
            a.product_id   AS product_a,
            b.product_id   AS product_b,
            COUNT(*)       AS co_basket_count
        FROM basket_items a
        JOIN basket_items b
            ON  a.basket_id   = b.basket_id
            AND a.product_id  < b.product_id    -- avoid duplicates & self-pairs
        GROUP BY a.product_id, b.product_id
    )
    SELECT
        pairs.product_a,
        pa.commodity_desc                           AS commodity_a,
        pa.department                               AS dept_a,
        pairs.product_b,
        pb.commodity_desc                           AS commodity_b,
        pb.department                               AS dept_b,
        pairs.co_basket_count,
        pairs.co_basket_count * 1.0 / {total}      AS support,
        -- Confidence: P(B | A)
        pairs.co_basket_count * 1.0 / pa.basket_count  AS confidence_a_to_b,
        -- Confidence: P(A | B)
        pairs.co_basket_count * 1.0 / pb.basket_count  AS confidence_b_to_a,
        -- Lift: actual co-occurrence / expected if independent
        (pairs.co_basket_count * 1.0 / {total})
            / (pa.support * pb.support)             AS lift
    FROM pairs
    JOIN product_support pa ON pairs.product_a = pa.product_id
    JOIN product_support pb ON pairs.product_b = pb.product_id
    WHERE pairs.co_basket_count * 1.0 / {total} >= {min_sup}
      AND (pairs.co_basket_count * 1.0 / {total})
            / (pa.support * pb.support) >= {min_lift}
    ORDER BY lift DESC
""".format(total=total_baskets, min_sup=MIN_SUPPORT, min_lift=MIN_LIFT))

n_pairs = con.execute("SELECT COUNT(*) FROM product_pairs").fetchone()[0]
print(f"      Pairs found (lift ≥ {MIN_LIFT}, support ≥ {MIN_SUPPORT}): {n_pairs:,}")

# ── Step 4: Seasonal lift breakdown ───────────────────────────────────────
# Map day numbers → seasons.  Dataset day 1 ≈ mid-winter (Jan).
# Days 1-91 = Winter, 92-182 = Spring, 183-274 = Summer, 275-365 = Fall
# Then the pattern repeats for year 2 (days 366-730).
print("\n[4/4] Computing seasonal co-occurrence (weather trigger base)...")

con.execute("""
    CREATE OR REPLACE TABLE seasonal_lift AS
    WITH season_map AS (
        SELECT
            basket_id,
            product_id,
            CASE
                WHEN (day % 365) BETWEEN 1  AND 91  THEN 'Winter'
                WHEN (day % 365) BETWEEN 92 AND 182 THEN 'Spring'
                WHEN (day % 365) BETWEEN 183 AND 274 THEN 'Summer'
                ELSE                                      'Fall'
            END AS season
        FROM transactions
        WHERE product_id IN (SELECT product_id FROM product_support)
    ),
    season_baskets AS (
        SELECT season, COUNT(DISTINCT basket_id) AS total_baskets
        FROM season_map
        GROUP BY season
    ),
    season_pairs AS (
        SELECT
            a.season,
            a.product_id   AS product_a,
            b.product_id   AS product_b,
            COUNT(*)       AS co_basket_count
        FROM (SELECT DISTINCT basket_id, product_id, season FROM season_map) a
        JOIN (SELECT DISTINCT basket_id, product_id, season FROM season_map) b
            ON  a.basket_id  = b.basket_id
            AND a.season     = b.season
            AND a.product_id < b.product_id
        GROUP BY a.season, a.product_id, b.product_id
    )
    SELECT
        sp.season,
        sp.product_a,
        pa.commodity_desc   AS commodity_a,
        sp.product_b,
        pb.commodity_desc   AS commodity_b,
        sp.co_basket_count,
        sp.co_basket_count * 1.0 / sb.total_baskets    AS seasonal_support,
        sp.co_basket_count * 1.0 / pa.basket_count     AS confidence_a_to_b,
        (sp.co_basket_count * 1.0 / sb.total_baskets)
            / (pa.support * pb.support)                AS seasonal_lift
    FROM season_pairs sp
    JOIN product_support pa ON sp.product_a = pa.product_id
    JOIN product_support pb ON sp.product_b = pb.product_id
    JOIN season_baskets  sb ON sp.season    = sb.season
    WHERE sp.co_basket_count * 1.0 / sb.total_baskets >= {min_sup}
      AND (sp.co_basket_count * 1.0 / sb.total_baskets)
            / (pa.support * pb.support) >= {min_lift}
    ORDER BY sp.season, seasonal_lift DESC
""".format(min_sup=MIN_SUPPORT, min_lift=MIN_LIFT))

# ── Export to CSV ─────────────────────────────────────────────────────────
pairs_path   = os.path.join(OUTPUT_DIR, "product_pairs.csv")
seasonal_path = os.path.join(OUTPUT_DIR, "seasonal_lift.csv")

con.execute(f"COPY product_pairs   TO '{pairs_path}'   (HEADER, DELIMITER ',')")
con.execute(f"COPY seasonal_lift   TO '{seasonal_path}' (HEADER, DELIMITER ',')")

print(f"\n  Outputs saved:")
print(f"    • {pairs_path}")
print(f"    • {seasonal_path}")

# ── Quick preview ─────────────────────────────────────────────────────────
print("\n  Top 10 product pairs by lift:")
print("  " + "-"*56)
top = con.execute("""
    SELECT commodity_a, commodity_b, ROUND(lift,2) AS lift, ROUND(support*100,3) AS support_pct
    FROM product_pairs
    ORDER BY lift DESC
    LIMIT 10
""").fetchdf()
print(top.to_string(index=False))

print("\n  Top Winter pairs (weather trigger candidates):")
print("  " + "-"*56)
winter = con.execute("""
    SELECT commodity_a, commodity_b,
           ROUND(seasonal_lift,2) AS seasonal_lift,
           ROUND(seasonal_support*100,3) AS support_pct
    FROM seasonal_lift
    WHERE season = 'Winter'
    ORDER BY seasonal_lift DESC
    LIMIT 10
""").fetchdf()
print(winter.to_string(index=False))

con.close()
print("\n" + "="*60)
print("  Done. Run 04_weather_trigger.py next.")
print("="*60 + "\n")
