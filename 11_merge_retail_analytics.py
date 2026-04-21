"""
11_merge_retail_analytics.py
============================
Patches ``output/unified_signal.json`` using **pre-built**
``output/retail_analytics.json`` (same idea as editing unified after
promo_attribution.json exists).

Typical flows
-------------
1) Full refresh (Dunnhumby + retail)::

    python 12_export_retail_analytics_json.py
    python 10_unified_signal.py          # merges retail JSON automatically

2) Retail CSVs only changed::

    python 12_export_retail_analytics_json.py
    python 11_merge_retail_analytics.py  # patch unified without re-running 10
"""

from __future__ import annotations

import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from retail_analytics_signals import (  # noqa: E402
    EXPORT_PATH,
    apply_retail_to_unified,
    load_retail_json,
)

UNIFIED_PATH = os.path.join(REPO_ROOT, "output", "unified_signal.json")


def main() -> None:
    retail = load_retail_json()
    if not retail:
        print(f"ERROR: {EXPORT_PATH} not found.")
        print("  Run:  python 12_export_retail_analytics_json.py")
        raise SystemExit(1)
    if not os.path.isfile(UNIFIED_PATH):
        print(f"ERROR: {UNIFIED_PATH} not found. Run python 10_unified_signal.py first.")
        raise SystemExit(1)

    with open(UNIFIED_PATH, encoding="utf-8") as f:
        unified: dict = json.load(f)

    apply_retail_to_unified(unified, retail)

    with open(UNIFIED_PATH, "w", encoding="utf-8") as f:
        json.dump(unified, f, indent=2, default=str)

    print(f"✓ Patched unified_signal.json from\n  {EXPORT_PATH}")


if __name__ == "__main__":
    main()
