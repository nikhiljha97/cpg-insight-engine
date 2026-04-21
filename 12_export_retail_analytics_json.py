#!/usr/bin/env python3
"""
12_export_retail_analytics_json.py
===================================
CSV / XLSX folder → standalone ``output/retail_analytics.json``
(same intermediate pattern as ``output/promo_attribution.json``).

Run before ``10_unified_signal.py`` so the unified bundle includes retail,
or run alone and then ``11_merge_retail_analytics.py`` to patch only unified.

Environment: see ``retail_analytics_signals.py`` (RETAIL_ANALYTICS_DIR, etc.).
"""

import os
import sys

REPO = os.path.dirname(os.path.abspath(__file__))
if REPO not in sys.path:
    sys.path.insert(0, REPO)

from retail_analytics_signals import (  # noqa: E402
    DATA_DIR,
    build_signals_dict,
    save_retail_json,
    EXPORT_PATH,
)


def main() -> None:
    if not os.path.isdir(DATA_DIR):
        print(f"SKIP: not a directory: {DATA_DIR}")
        return
    signals = build_signals_dict()
    save_retail_json(signals)
    print(f"✓ Wrote {EXPORT_PATH}")
    g = signals.get("grocery_listings_by_month") or []
    print(f"  Grocery months: {len(g)}")
    if signals.get("supermarket_sales"):
        print("  Supermarket sales: yes")
    if signals.get("toronto_daily_weather_file"):
        print("  Toronto weatherstats: yes")


if __name__ == "__main__":
    main()
