#!/usr/bin/env python3
"""
Run the offline analytics pipeline in order.

Usage (from repo root):
  python scripts/run_pipeline.py

Environment (optional):
  CPG_DATA_DIR            — folder with Complete Journey CSVs (see 02_load_data.py)
  RETAIL_ANALYTICS_DIR    — folder with grocery_data_*.csv etc. (see 12_export_retail_analytics_json.py)
  RETAIL_GROCERY_MAX_ROWS — cap per grocery file when merging (default 200000)

If Dunnhumby core CSVs are missing, steps 02–09 are skipped. Step 10 is
skipped when unified already exists (10 would clear pairs without CSVs).
``12_export_retail_analytics_json.py`` writes ``output/retail_analytics.json``;
``10_unified_signal.py`` merges it when present; ``11_merge_retail_analytics.py``
patches unified only. ``04_weather_trigger.py`` always runs.
"""
from __future__ import annotations

import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def have_complete_journey_csvs() -> bool:
    root = os.environ.get("CPG_DATA_DIR", REPO)
    root = os.path.abspath(os.path.expanduser(root))
    return os.path.isfile(os.path.join(root, "transaction_data.csv")) and os.path.isfile(
        os.path.join(root, "product.csv")
    )


def run(cmd: list[str]) -> None:
    print("\n" + "=" * 72)
    print(" ", " ".join(cmd))
    print("=" * 72)
    r = subprocess.run(cmd, cwd=REPO)
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main() -> None:
    os.chdir(REPO)
    py = sys.executable
    unified_path = os.path.join(REPO, "output", "unified_signal.json")

    if have_complete_journey_csvs():
        run([py, "02_load_data.py"])
        run([py, "06_load_extended_data.py"])
        run([py, "03_market_basket.py"])
        run([py, "07_promo_attribution.py"])
        run([py, "08_price_elasticity.py"])
        run([py, "09_demographic_segmentation.py"])
        run([py, "12_export_retail_analytics_json.py"])
        run([py, "10_unified_signal.py"])
    else:
        print(
            "\n*** SKIP 02–10: Dunnhumby Complete Journey CSVs not found ***\n"
            "    Set CPG_DATA_DIR to the folder containing transaction_data.csv and product.csv,\n"
            "    then re-run. (Running 10 without new basket outputs would empty pair lists.)\n",
            flush=True,
        )
        run([py, "12_export_retail_analytics_json.py"])
        if not os.path.isfile(unified_path):
            print(
                "    No unified_signal.json yet — running 10_unified_signal.py once.\n",
                flush=True,
            )
            run([py, "10_unified_signal.py"])
        else:
            run([py, "11_merge_retail_analytics.py"])

    run([py, "04_weather_trigger.py"])
    print("\n✓ Pipeline runner finished.\n")


if __name__ == "__main__":
    main()
