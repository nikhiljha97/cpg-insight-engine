"""
07_promo_attribution.py
Analyse promotional effectiveness across all datasets:
  - Breakfast at Frat: display vs mailer vs TPR lift by category + store tier
  - Carbo-Loading: feature_desc + display_desc lift on pasta/sauce
  - Complete Journey: causal_data mailer vs display flag lift

Outputs:
  output/promo_attribution.json   — unified promo signal for dashboard API
  output/promo_batf.csv           — Breakfast at Frat detail
  output/promo_carbo.csv          — Carbo-Loading detail

Run from: ~/Downloads/retail_analytics/
"""
import duckdb
import json
import os

os.makedirs("output", exist_ok=True)
con = duckdb.connect("retail.duckdb", read_only=True)

results = {}

# ── 1. BREAKFAST AT THE FRAT: Display vs Mailer vs TPR ───────────────────────
print("=== Breakfast at the Frat: Promo Attribution ===")
try:
    batf = con.execute("""
        SELECT
            p.CATEGORY,
            s.SEG_VALUE_NAME AS store_tier,
            ROUND(AVG(CASE WHEN t.DISPLAY = 1 AND t.FEATURE = 0 AND t.TPR_ONLY = 0
                          THEN t.UNITS ELSE NULL END), 2) AS avg_units_display_only,
            ROUND(AVG(CASE WHEN t.FEATURE = 1 AND t.DISPLAY = 0 AND t.TPR_ONLY = 0
                          THEN t.UNITS ELSE NULL END), 2) AS avg_units_mailer_only,
            ROUND(AVG(CASE WHEN t.DISPLAY = 1 AND t.FEATURE = 1
                          THEN t.UNITS ELSE NULL END), 2) AS avg_units_display_and_mailer,
            ROUND(AVG(CASE WHEN t.TPR_ONLY = 1
                          THEN t.UNITS ELSE NULL END), 2) AS avg_units_tpr_only,
            ROUND(AVG(CASE WHEN t.DISPLAY = 0 AND t.FEATURE = 0 AND t.TPR_ONLY = 0
                          THEN t.UNITS ELSE NULL END), 2) AS avg_units_baseline,
            COUNT(*) AS observations
        FROM batf_transactions t
        JOIN batf_product_lookup p ON t.UPC = p.UPC
        JOIN batf_store_lookup s ON t.STORE_NUM = s.STORE_ID
        GROUP BY p.CATEGORY, s.SEG_VALUE_NAME
        ORDER BY p.CATEGORY, s.SEG_VALUE_NAME
    """).df()

    batf.to_csv("output/promo_batf.csv", index=False)
    print(batf.to_string(index=False))

    # Compute lift multipliers vs baseline
    batf_summary = []
    for _, row in batf.iterrows():
        base = row["avg_units_baseline"] or 1
        batf_summary.append({
            "category": row["CATEGORY"],
            "store_tier": row["store_tier"],
            "display_lift": round((row["avg_units_display_only"] or base) / base, 2),
            "mailer_lift": round((row["avg_units_mailer_only"] or base) / base, 2),
            "display_and_mailer_lift": round((row["avg_units_display_and_mailer"] or base) / base, 2),
            "tpr_lift": round((row["avg_units_tpr_only"] or base) / base, 2),
            "baseline_units": round(base, 2),
            "observations": int(row["observations"])
        })
    results["batf_promo"] = batf_summary
    print(f"\n  Saved output/promo_batf.csv ({len(batf)} rows)")
except Exception as e:
    print(f"  SKIP batf_promo: {e}")

# ── 2. CARBO-LOADING: Feature + Display type attribution ─────────────────────
print("\n=== Carbo-Loading: Promo Attribution ===")
try:
    carbo = con.execute("""
        SELECT
            p.commodity,
            c.feature_desc,
            c.display_desc,
            COUNT(DISTINCT t.basket) AS baskets,
            ROUND(SUM(t.units), 0) AS total_units,
            ROUND(SUM(t.dollar_sales), 2) AS total_sales
        FROM carbo_transactions t
        JOIN carbo_product_lookup p ON t.upc = p.upc
        JOIN carbo_causal_lookup c ON t.upc = c.upc AND t.store = c.store AND t.week = c.week
        GROUP BY p.commodity, c.feature_desc, c.display_desc
        ORDER BY total_units DESC
        LIMIT 40
    """).df()

    carbo.to_csv("output/promo_carbo.csv", index=False)
    print(carbo.head(15).to_string(index=False))

    # Top promo types per commodity
    carbo_summary = []
    for _, row in carbo.iterrows():
        carbo_summary.append({
            "commodity": row["commodity"],
            "feature_type": row["feature_desc"],
            "display_type": row["display_desc"],
            "baskets": int(row["baskets"]),
            "total_units": int(row["total_units"]),
            "total_sales": float(row["total_sales"])
        })
    results["carbo_promo"] = carbo_summary[:20]
    print(f"\n  Saved output/promo_carbo.csv")
except Exception as e:
    print(f"  SKIP carbo_promo: {e}")

# ── 3. COMPLETE JOURNEY: Mailer vs Display vs None ───────────────────────────
print("\n=== Complete Journey: Promo Attribution ===")
try:
    cj = con.execute("""
        SELECT
            p.DEPARTMENT,
            p.COMMODITY_DESC,
            ROUND(AVG(CASE WHEN c.display = '1' AND c.mailer = '0'
                          THEN t.SALES_VALUE ELSE NULL END), 2) AS avg_sales_display,
            ROUND(AVG(CASE WHEN c.mailer = '1' AND c.display = '0'
                          THEN t.SALES_VALUE ELSE NULL END), 2) AS avg_sales_mailer,
            ROUND(AVG(CASE WHEN c.display = '1' AND c.mailer = '1'
                          THEN t.SALES_VALUE ELSE NULL END), 2) AS avg_sales_both,
            ROUND(AVG(CASE WHEN c.display IS NULL AND c.mailer IS NULL
                          THEN t.SALES_VALUE ELSE NULL END), 2) AS avg_sales_baseline,
            COUNT(*) AS observations
        FROM transaction_data t
        JOIN product p ON t.PRODUCT_ID = p.PRODUCT_ID
        LEFT JOIN causal_data c ON t.PRODUCT_ID = c.PRODUCT_ID
            AND t.STORE_ID = c.STORE_ID
            AND t.WEEK_NO = c.WEEK_NO
        WHERE p.DEPARTMENT IN ('SOUP', 'DAIRY', 'BREAD AND BAKED GOODS',
                               'FROZEN FOODS', 'SNACKS')
        GROUP BY p.DEPARTMENT, p.COMMODITY_DESC
        HAVING COUNT(*) > 100
        ORDER BY p.DEPARTMENT, observations DESC
        LIMIT 30
    """).df()

    cj_summary = []
    for _, row in cj.iterrows():
        base = row["avg_sales_baseline"] or 0.01
        cj_summary.append({
            "department": row["DEPARTMENT"],
            "commodity": row["COMMODITY_DESC"],
            "display_lift": round((row["avg_sales_display"] or base) / base, 2),
            "mailer_lift": round((row["avg_sales_mailer"] or base) / base, 2),
            "combined_lift": round((row["avg_sales_both"] or base) / base, 2),
        })
    results["cj_promo"] = cj_summary
    print(f"  Complete Journey promo: {len(cj_summary)} commodity rows")
except Exception as e:
    print(f"  SKIP cj_promo: {e}")

# ── Save unified output ───────────────────────────────────────────────────────
with open("output/promo_attribution.json", "w") as f:
    json.dump(results, f, indent=2)

con.close()
print("\n✓ Saved output/promo_attribution.json")
