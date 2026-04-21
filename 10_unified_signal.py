"""
10_unified_signal.py
Merge all analysis outputs into one unified_signal.json
This is what the dashboard API serves — all signals pre-computed,
ready to be passed to Groq for city-specific pitch generation.

Reads from output/:
  product_pairs.csv
  seasonal_lift.csv
  promo_attribution.json
  price_elasticity.json
  demographic_segmentation.json
  retail_analytics.json   (optional — from 12_export_retail_analytics_json.py)

Outputs:
  output/unified_signal.json

Run from: ~/Downloads/retail_analytics/
"""
import json
import os
import csv

os.makedirs("output", exist_ok=True)

def load_json(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    print(f"  MISSING: {path}")
    return {}

def load_csv_top(path, n=10):
    if not os.path.exists(path):
        print(f"  MISSING: {path}")
        return []
    rows = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= n:
                break
            rows.append({k: v for k, v in row.items()})
    return rows

print("Loading analysis outputs...")

promo     = load_json("output/promo_attribution.json")
elasticity= load_json("output/price_elasticity.json")
demo      = load_json("output/demographic_segmentation.json")
pairs     = load_csv_top("output/product_pairs.csv", 10)
seasonal  = load_csv_top("output/seasonal_lift.csv", 20)

# ── Basket companions (hardcoded from 03_market_basket.py results) ────────────
soup_companions = [
    {"product": "Fluid Milk",     "pct_of_soup_baskets": 48.0},
    {"product": "Bananas",        "pct_of_soup_baskets": 29.0},
    {"product": "White Bread",    "pct_of_soup_baskets": 25.6},
    {"product": "Shredded Cheese","pct_of_soup_baskets": 23.2},
    {"product": "Soft Drinks",    "pct_of_soup_baskets": 19.5},
    {"product": "Orange Juice",   "pct_of_soup_baskets": 15.6},
    {"product": "Kids Cereal",    "pct_of_soup_baskets": 14.9},
    {"product": "Potato Chips",   "pct_of_soup_baskets": 14.4},
]

top_cross_dept = [
    {"pair": "Hot Dog Buns + Premium Beef",       "lift": 14.6},
    {"pair": "Hot Dog Buns + Premium Meat",       "lift": 13.3},
    {"pair": "Frozen Patties + Hamburger Buns",   "lift": 10.8},
    {"pair": "Refrigerated Biscuits + Pork Rolls","lift": 10.2},
]

# ── Best promo tactic by category (from BATF data) ────────────────────────────
best_promo_by_category = {}
for row in promo.get("batf_promo", []):
    cat = row["category"]
    lifts = {
        "display": row.get("display_lift", 1),
        "mailer": row.get("mailer_lift", 1),
        "display+mailer": row.get("display_and_mailer_lift", 1),
        "tpr": row.get("tpr_lift", 1),
    }
    best_tactic = max(lifts, key=lifts.get)
    best_lift   = lifts[best_tactic]
    if cat not in best_promo_by_category or best_lift > best_promo_by_category[cat]["lift"]:
        best_promo_by_category[cat] = {
            "category": cat,
            "store_tier": row.get("store_tier"),
            "best_tactic": best_tactic,
            "lift": best_lift,
            "baseline_units": row.get("baseline_units")
        }

# ── Best store tier for activation (highest display+mailer lift) ──────────────
tier_scores = {}
for row in promo.get("batf_promo", []):
    tier = row.get("store_tier", "Unknown")
    lift = row.get("display_and_mailer_lift", 1)
    if tier not in tier_scores or lift > tier_scores[tier]:
        tier_scores[tier] = lift

best_store_tier = max(tier_scores, key=tier_scores.get) if tier_scores else "Mainstream"

# ── Top elastic categories (most sensitive to price) ─────────────────────────
elastic_cats = sorted(
    [r for r in elasticity.get("price_elasticity", []) if r.get("elasticity_coef")],
    key=lambda x: x["elasticity_coef"]
)[:5]

# ── Top soup buyer demographic segment ───────────────────────────────────────
top_demo_segment = {}
soup_profiles = demo.get("soup_buyer_profile", [])
if soup_profiles:
    top_seg = max(soup_profiles, key=lambda x: float(x.get("soup_penetration_pct", 0)))
    top_demo_segment = {
        "age_group": top_seg.get("age_group"),
        "income_group": top_seg.get("income_group"),
        "has_kids": top_seg.get("has_kids"),
        "homeowner": top_seg.get("homeowner"),
        "soup_penetration_pct": top_seg.get("soup_penetration_pct")
    }

# ── Coupon effectiveness ───────────────────────────────────────────────────────
coupon_data = demo.get("coupon_usage_by_dept", [])

# ── Assemble unified signal ───────────────────────────────────────────────────
unified = {
    "meta": {
        "datasets_used": [
            "Complete Journey (2.59M transactions, 8 tables)",
            "Carbo-Loading (5.19M transactions, Pasta/Sauce/Syrup)",
            "Breakfast at the Frat (682K rows, 156 weeks, price+promo)",
            "Let's Get Sort-of-Real (300M transactions, basket missions)"
        ],
        "last_updated": __import__("datetime").datetime.now().isoformat()
    },
    "basket_analysis": {
        "soup_companions": soup_companions,
        "top_cross_dept_pairs": top_cross_dept,
        "top_product_pairs": pairs
    },
    "promo_attribution": {
        "best_tactic_by_category": list(best_promo_by_category.values()),
        "best_store_tier_for_activation": best_store_tier,
        "store_tier_lift_scores": tier_scores,
        "carbo_top_promo": promo.get("carbo_promo", [])[:5],
        "cj_promo": promo.get("cj_promo", [])[:10]
    },
    "price_elasticity": {
        "most_elastic_categories": elastic_cats,
        "discount_depth_impact": elasticity.get("discount_depth", []),
        "store_tier_summary": elasticity.get("store_tier_summary", [])
    },
    "demographics": {
        "top_soup_buyer_segment": top_demo_segment,
        "all_segments": soup_profiles[:10],
        "coupon_usage_by_dept": coupon_data,
        "spend_trajectory": demo.get("spend_trajectory", [])
    }
}

try:
    from retail_analytics_signals import apply_retail_to_unified, load_retail_json

    _retail = load_retail_json()
    if _retail:
        apply_retail_to_unified(unified, _retail)
        print("  Merged output/retail_analytics.json into unified.")
except Exception as _e:  # noqa: BLE001
    print(f"  (retail_analytics.json not merged: {_e})")

with open("output/unified_signal.json", "w") as f:
    json.dump(unified, f, indent=2, default=str)

print("\n✓ Saved output/unified_signal.json")
print("\nKey signals summary:")
print(f"  Soup companions: {len(soup_companions)}")
print(f"  Best promo tactic categories: {len(best_promo_by_category)}")
print(f"  Best store tier: {best_store_tier}")
print(f"  Elastic categories: {len(elastic_cats)}")
print(f"  Demographic segments: {len(soup_profiles)}")
print(f"  Coupon dept data: {len(coupon_data)}")
