"""
09_demographic_segmentation.py
Who are the cold-weather buyers?
Uses Complete Journey hh_demographic + transaction_data to profile
households that buy SOUP, DAIRY, BREAD during cold/wet season weeks.

Also uses Let's Get Sort-of-Real affluence + basket_type if available.

Outputs:
  output/demographic_segmentation.json

Run from: ~/Downloads/retail_analytics/
"""
import duckdb
import json
import os

os.makedirs("output", exist_ok=True)
con = duckdb.connect("retail.duckdb", read_only=True)

results = {}

# ── 1. Complete Journey: Who buys SOUP? ──────────────────────────────────────
print("=== Complete Journey: Soup Buyer Demographics ===")
try:
    soup_demo = con.execute("""
        WITH soup_buyers AS (
            SELECT DISTINCT t.household_key
            FROM transaction_data t
            JOIN product p ON t.PRODUCT_ID = p.PRODUCT_ID
            WHERE UPPER(p.COMMODITY_DESC) LIKE '%SOUP%'
        ),
        all_buyers AS (
            SELECT DISTINCT household_key FROM transaction_data
        )
        SELECT
            d.classification_1 AS age_group,
            d.classification_5 AS income_group,
            d.KID_CATEGORY_DESC AS has_kids,
            d.HOMEOWNER_DESC AS homeowner,
            d.classification_2 AS marital_status,
            COUNT(CASE WHEN s.household_key IS NOT NULL THEN 1 END) AS soup_buyers,
            COUNT(*) AS total_buyers,
            ROUND(100.0 * COUNT(CASE WHEN s.household_key IS NOT NULL THEN 1 END) / COUNT(*), 1) AS soup_penetration_pct
        FROM hh_demographic d
        JOIN all_buyers a ON d.household_key = a.household_key
        LEFT JOIN soup_buyers s ON d.household_key = s.household_key
        GROUP BY d.classification_1, d.classification_5, d.KID_CATEGORY_DESC,
                 d.HOMEOWNER_DESC, d.classification_2
        HAVING COUNT(*) >= 5
        ORDER BY soup_penetration_pct DESC
        LIMIT 30
    """).df()

    print(soup_demo.head(10).to_string(index=False))

    results["soup_buyer_profile"] = soup_demo.to_dict("records")
    print(f"  {len(soup_demo)} demographic segments with soup penetration data")

except Exception as e:
    print(f"  SKIP soup_demo: {e}")

# ── 2. Spend trajectory: Are soup buyers spending more over time? ─────────────
print("\n=== Spend Trajectory: Soup Buyers vs Non-Soup Buyers ===")
try:
    trajectory = con.execute("""
        WITH soup_buyers AS (
            SELECT DISTINCT t.household_key
            FROM transaction_data t
            JOIN product p ON t.PRODUCT_ID = p.PRODUCT_ID
            WHERE UPPER(p.COMMODITY_DESC) LIKE '%SOUP%'
        )
        SELECT
            t.WEEK_NO,
            CASE WHEN s.household_key IS NOT NULL THEN 'Soup Buyer' ELSE 'Non-Soup Buyer' END AS segment,
            ROUND(AVG(t.SALES_VALUE), 3) AS avg_weekly_spend,
            COUNT(DISTINCT t.household_key) AS households
        FROM transaction_data t
        LEFT JOIN soup_buyers s ON t.household_key = s.household_key
        GROUP BY t.WEEK_NO, segment
        ORDER BY t.WEEK_NO, segment
    """).df()

    # Summarize into early/mid/late thirds
    max_week = int(trajectory["WEEK_NO"].max())
    thirds = {"early": (1, max_week//3), "mid": (max_week//3+1, 2*max_week//3), "late": (2*max_week//3+1, max_week)}
    traj_summary = []
    for period, (w1, w2) in thirds.items():
        for seg in ["Soup Buyer", "Non-Soup Buyer"]:
            subset = trajectory[(trajectory["WEEK_NO"].between(w1, w2)) & (trajectory["segment"] == seg)]
            if len(subset):
                traj_summary.append({
                    "period": period,
                    "weeks": f"{w1}-{w2}",
                    "segment": seg,
                    "avg_spend": round(float(subset["avg_weekly_spend"].mean()), 3)
                })
    results["spend_trajectory"] = traj_summary

except Exception as e:
    print(f"  SKIP trajectory: {e}")

# ── 3. Coupon usage among cold-weather category buyers ───────────────────────
print("\n=== Coupon Usage: Cold-Weather Categories ===")
try:
    coupon_usage = con.execute("""
        WITH cold_cat_buyers AS (
            SELECT DISTINCT t.household_key, p.DEPARTMENT
            FROM transaction_data t
            JOIN product p ON t.PRODUCT_ID = p.PRODUCT_ID
            WHERE p.DEPARTMENT IN ('SOUP', 'DAIRY', 'BREAD AND BAKED GOODS', 'FROZEN FOODS')
        ),
        redeemers AS (
            SELECT DISTINCT household_key FROM coupon_redempt
        )
        SELECT
            ccb.DEPARTMENT,
            COUNT(DISTINCT ccb.household_key) AS total_hh,
            COUNT(DISTINCT r.household_key) AS coupon_users,
            ROUND(100.0 * COUNT(DISTINCT r.household_key) / COUNT(DISTINCT ccb.household_key), 1) AS coupon_pct
        FROM cold_cat_buyers ccb
        LEFT JOIN redeemers r ON ccb.household_key = r.household_key
        GROUP BY ccb.DEPARTMENT
        ORDER BY coupon_pct DESC
    """).df()

    print(coupon_usage.to_string(index=False))
    results["coupon_usage_by_dept"] = coupon_usage.to_dict("records")

except Exception as e:
    print(f"  SKIP coupon_usage: {e}")

# ── 4. Let's Get Sort-of-Real: basket mission + affluence (if loaded) ─────────
print("\n=== LGSR: Basket Mission + Affluence Tier ===")
try:
    tables = con.execute("SHOW TABLES").df()["name"].tolist()
    if "lgsr_transactions" in tables:
        cols = con.execute("DESCRIBE lgsr_transactions").df()["column_name"].str.lower().tolist()
        print(f"  LGSR columns: {cols[:15]}")

        mission_cols = [c for c in cols if "mission" in c or "basket_type" in c or "affluence" in c or "seg" in c]
        print(f"  Segment columns found: {mission_cols}")

        if mission_cols:
            group_col = mission_cols[0]
            lgsr = con.execute(f"""
                SELECT
                    {group_col},
                    COUNT(*) AS transactions,
                    ROUND(AVG(spend), 2) AS avg_spend
                FROM lgsr_transactions
                GROUP BY {group_col}
                ORDER BY transactions DESC
            """).df()
            print(lgsr.to_string(index=False))
            results["lgsr_segments"] = lgsr.to_dict("records")
    else:
        print("  lgsr_transactions not loaded yet")
except Exception as e:
    print(f"  SKIP lgsr: {e}")

# ── Save ─────────────────────────────────────────────────────────────────────
with open("output/demographic_segmentation.json", "w") as f:
    json.dump(results, f, indent=2, default=str)

con.close()
print("\n✓ Saved output/demographic_segmentation.json")
