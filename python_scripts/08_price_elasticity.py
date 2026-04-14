"""
08_price_elasticity.py
Price elasticity analysis using Breakfast at the Frat data:
  - Price vs units relationship by category
  - Store tier effect (Value vs Mainstream vs Upscale)
  - Discount depth impact (base_price - price = discount)
  - Cold-week vs warm-week price sensitivity (week number proxy)

Outputs:
  output/price_elasticity.json   — elasticity curves for dashboard API
  output/price_elasticity.csv    — full detail

Run from: ~/Downloads/retail_analytics/
"""
import duckdb
import json
import os
import numpy as np

os.makedirs("output", exist_ok=True)
con = duckdb.connect("retail.duckdb", read_only=True)

results = {}

# ── 1. Price elasticity by category + store tier ─────────────────────────────
print("=== Price Elasticity by Category + Store Tier ===")
try:
    df = con.execute("""
        SELECT
            p.CATEGORY,
            s.SEG_VALUE_NAME AS store_tier,
            ROUND(t.PRICE, 2) AS price_bucket,
            ROUND(AVG(t.UNITS), 2) AS avg_units,
            ROUND(AVG(t.SPEND), 2) AS avg_spend,
            ROUND(AVG(t.HHS), 2) AS avg_households,
            COUNT(*) AS observations
        FROM batf_transactions t
        JOIN batf_product_lookup p ON t.UPC = p.UPC
        JOIN batf_store_lookup s ON t.STORE_NUM = s.STORE_ID
        WHERE t.PRICE > 0 AND t.UNITS > 0
        GROUP BY p.CATEGORY, s.SEG_VALUE_NAME, ROUND(t.PRICE, 2)
        HAVING COUNT(*) >= 10
        ORDER BY p.CATEGORY, s.SEG_VALUE_NAME, price_bucket
    """).df()

    df.to_csv("output/price_elasticity.csv", index=False)

    # Compute elasticity coefficient per category+tier
    elasticity_summary = []
    for (cat, tier), group in df.groupby(["CATEGORY", "store_tier"]):
        if len(group) < 3:
            continue
        prices = group["price_bucket"].values
        units = group["avg_units"].values
        # log-log regression for elasticity
        try:
            log_p = np.log(prices + 0.01)
            log_u = np.log(units + 0.01)
            coef = np.polyfit(log_p, log_u, 1)
            elasticity = round(coef[0], 3)
        except:
            elasticity = None

        # price points for sparkline
        price_points = group.sort_values("price_bucket")[["price_bucket", "avg_units"]].head(10).to_dict("records")

        elasticity_summary.append({
            "category": cat,
            "store_tier": tier,
            "elasticity_coef": elasticity,
            "interpretation": (
                "Highly elastic — big unit drop when price rises" if elasticity and elasticity < -1.5
                else "Elastic — units sensitive to price" if elasticity and elasticity < -0.5
                else "Inelastic — loyal buyers, price changes have low impact" if elasticity
                else "Insufficient data"
            ),
            "avg_price": round(float(group["price_bucket"].mean()), 2),
            "avg_units": round(float(group["avg_units"].mean()), 2),
            "price_points": price_points
        })

    results["price_elasticity"] = elasticity_summary
    print(f"  Computed elasticity for {len(elasticity_summary)} category/tier combos")
    for row in elasticity_summary[:6]:
        print(f"  {row['category']} / {row['store_tier']}: elasticity={row['elasticity_coef']} ({row['interpretation']})")

except Exception as e:
    print(f"  SKIP price_elasticity: {e}")

# ── 2. Discount depth impact ─────────────────────────────────────────────────
print("\n=== Discount Depth Impact ===")
try:
    disc = con.execute("""
        SELECT
            p.CATEGORY,
            CASE
                WHEN (t.BASE_PRICE - t.PRICE) / NULLIF(t.BASE_PRICE, 0) < 0.05 THEN '0-5% off'
                WHEN (t.BASE_PRICE - t.PRICE) / NULLIF(t.BASE_PRICE, 0) < 0.15 THEN '5-15% off'
                WHEN (t.BASE_PRICE - t.PRICE) / NULLIF(t.BASE_PRICE, 0) < 0.30 THEN '15-30% off'
                ELSE '30%+ off'
            END AS discount_tier,
            ROUND(AVG(t.UNITS), 2) AS avg_units,
            ROUND(AVG(t.VISITS), 2) AS avg_visits,
            ROUND(AVG(t.HHS), 2) AS avg_hhs,
            COUNT(*) AS observations
        FROM batf_transactions t
        JOIN batf_product_lookup p ON t.UPC = p.UPC
        WHERE t.BASE_PRICE > 0 AND t.PRICE > 0
        GROUP BY p.CATEGORY, discount_tier
        ORDER BY p.CATEGORY, discount_tier
    """).df()

    discount_summary = []
    for _, row in disc.iterrows():
        discount_summary.append({
            "category": row["CATEGORY"],
            "discount_tier": row["discount_tier"],
            "avg_units": float(row["avg_units"]),
            "avg_visits": float(row["avg_visits"]),
            "avg_households": float(row["avg_hhs"]),
            "observations": int(row["observations"])
        })
    results["discount_depth"] = discount_summary
    print(f"  Computed discount depth for {len(discount_summary)} rows")

except Exception as e:
    print(f"  SKIP discount_depth: {e}")

# ── 3. Store tier comparison summary ────────────────────────────────────────
print("\n=== Store Tier Summary ===")
try:
    tier = con.execute("""
        SELECT
            s.SEG_VALUE_NAME AS store_tier,
            COUNT(DISTINCT s.STORE_ID) AS store_count,
            ROUND(AVG(s.SALES_AREA_SIZE_NUM), 0) AS avg_sqft,
            ROUND(AVG(s.AVG_WEEKLY_BASKETS), 0) AS avg_weekly_baskets,
            ROUND(AVG(t.PRICE), 2) AS avg_shelf_price,
            ROUND(AVG(t.BASE_PRICE - t.PRICE), 3) AS avg_discount_amount,
            ROUND(AVG(t.UNITS), 2) AS avg_units_per_sku_week
        FROM batf_store_lookup s
        JOIN batf_transactions t ON s.STORE_ID = t.STORE_NUM
        GROUP BY s.SEG_VALUE_NAME
        ORDER BY avg_shelf_price
    """).df()

    results["store_tier_summary"] = tier.to_dict("records")
    print(tier.to_string(index=False))

except Exception as e:
    print(f"  SKIP store_tier_summary: {e}")

# ── Save ─────────────────────────────────────────────────────────────────────
with open("output/price_elasticity.json", "w") as f:
    json.dump(results, f, indent=2, default=str)

con.close()
print("\n✓ Saved output/price_elasticity.json")
