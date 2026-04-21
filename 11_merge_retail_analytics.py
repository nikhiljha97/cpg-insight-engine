"""
11_merge_retail_analytics.py
============================
Merges CSV/XLSX summaries from the local ``retail_analytics`` folder (or any
path) into ``output/unified_signal.json`` under the key ``retail_analytics``.

Run **after** ``10_unified_signal.py``::

    python 10_unified_signal.py
    python 11_merge_retail_analytics.py

Environment
-----------
RETAIL_ANALYTICS_DIR   Folder with grocery_data_*.csv, supermarket_sales.csv,
                       weatherstats_toronto_daily.csv, CPI_*.csv, etc.
                       Default: ``<repo>/../retail_analytics`` (sibling folder).

RETAIL_GROCERY_MAX_ROWS   Max rows read per grocery CSV for mean price (speed).
                       Default: 200000.
"""

from __future__ import annotations

import glob
import json
import os
import re
from datetime import datetime
from typing import Any

import pandas as pd

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
UNIFIED_PATH = os.path.join(REPO_ROOT, "output", "unified_signal.json")

_DEFAULT_SIBLING = os.path.abspath(os.path.join(REPO_ROOT, "..", "retail_analytics"))
DATA_DIR = os.path.abspath(
    os.path.expanduser(os.environ.get("RETAIL_ANALYTICS_DIR", _DEFAULT_SIBLING))
)
GROCERY_CAP = int(os.environ.get("RETAIL_GROCERY_MAX_ROWS", "200000"))
CSV_ENCODING = os.environ.get("RETAIL_CSV_ENCODING", "utf-8")
CSV_ENCODING_FALLBACK = "latin-1"


def read_csv_flexible(path: str, **kwargs: Any) -> pd.DataFrame:
    try:
        return pd.read_csv(path, encoding=CSV_ENCODING, **kwargs)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding=CSV_ENCODING_FALLBACK, **kwargs)


MON_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _month_from_grocery_filename(name: str) -> str | None:
    m = re.search(r"grocery_data_([a-z]{3})_(\d{4})\.csv$", name.lower())
    if not m:
        return None
    mon_s, yr = m.group(1), m.group(2)
    mi = MON_MAP.get(mon_s)
    if not mi:
        return None
    return f"{yr}-{mi:02d}"


def summarize_grocery_files() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    paths = sorted(glob.glob(os.path.join(DATA_DIR, "grocery_data_*.csv")))
    for path in paths:
        label = _month_from_grocery_filename(os.path.basename(path))
        if not label:
            continue
        try:
            df = read_csv_flexible(path, usecols=["pricing.price"], nrows=GROCERY_CAP, low_memory=False)
        except (ValueError, KeyError):
            try:
                df = read_csv_flexible(path, nrows=GROCERY_CAP, low_memory=False)
                col = next((c for c in df.columns if c.endswith("pricing.price") or c == "pricing.price"), None)
                if col is None:
                    out.append({"month": label, "error": "no pricing.price column", "file": os.path.basename(path)})
                    continue
                df = df[[col]].rename(columns={col: "pricing.price"})
            except Exception as e:  # noqa: BLE001
                out.append({"month": label, "error": str(e), "file": os.path.basename(path)})
                continue
        s = pd.to_numeric(df["pricing.price"], errors="coerce").dropna()
        if s.empty:
            out.append({"month": label, "rows_used": 0, "mean_list_price": None, "file": os.path.basename(path)})
            continue
        out.append(
            {
                "month": label,
                "rows_used": int(s.shape[0]),
                "rows_cap": GROCERY_CAP,
                "mean_list_price": round(float(s.mean()), 4),
                "median_list_price": round(float(s.median()), 4),
                "file": os.path.basename(path),
            }
        )
    return out


def summarize_supermarket_sales() -> dict[str, Any] | None:
    path = os.path.join(DATA_DIR, "supermarket_sales.csv")
    if not os.path.isfile(path):
        return None
    df = read_csv_flexible(path, low_memory=False)
    if "Revenue" not in df.columns or "Region" not in df.columns:
        return {"error": "missing Revenue or Region columns", "file": "supermarket_sales.csv"}
    df["Revenue"] = pd.to_numeric(df["Revenue"], errors="coerce")
    g = df.groupby("Region", dropna=False)["Revenue"].sum().sort_values(ascending=False)
    return {
        "file": "supermarket_sales.csv",
        "rows": len(df),
        "total_revenue": round(float(df["Revenue"].sum()), 2),
        "revenue_by_region": [{"region": str(k), "revenue": round(float(v), 2)} for k, v in g.items()],
    }


def summarize_toronto_weather() -> dict[str, Any] | None:
    path = os.path.join(DATA_DIR, "weatherstats_toronto_daily.csv")
    if not os.path.isfile(path):
        return None
    df = read_csv_flexible(path, low_memory=False)
    if "date" not in df.columns:
        return {"error": "missing date column", "file": os.path.basename(path)}
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df = df.sort_values("date")
    last = df.tail(90)
    temp_col = "avg_temperature" if "avg_temperature" in df.columns else None
    precip_col = "precipitation" if "precipitation" in df.columns else None
    block: dict[str, Any] = {
        "file": os.path.basename(path),
        "rows": len(df),
        "date_min": str(df["date"].min().date()),
        "date_max": str(df["date"].max().date()),
        "last_90_days": {},
    }
    if temp_col:
        t = pd.to_numeric(last[temp_col], errors="coerce").dropna()
        block["last_90_days"]["avg_temp_c"] = round(float(t.mean()), 2) if len(t) else None
    if precip_col:
        p = pd.to_numeric(last[precip_col], errors="coerce").fillna(0)
        block["last_90_days"]["total_precip_mm"] = round(float(p.sum()), 2)
    return block


def wide_latest_toronto(csv_name: str) -> dict[str, Any] | None:
    """Latest column value for the Toronto row (CPI wide months or unemployment years)."""
    path = os.path.join(DATA_DIR, csv_name)
    if not os.path.isfile(path):
        return None
    df = read_csv_flexible(path, low_memory=False)
    if "City" not in df.columns:
        return None
    t = df[df["City"].astype(str).str.strip() == "Toronto"]
    if t.empty:
        t = df.iloc[[0]]
    row = t.iloc[0]
    cols = [c for c in df.columns if c != "City"]
    if not cols:
        return None
    latest_col = cols[-1]
    val = row.get(latest_col)
    try:
        val_f = float(val) if pd.notna(val) else None
    except (TypeError, ValueError):
        val_f = None
    return {
        "file": csv_name,
        "city": str(row["City"]),
        "latest_period": str(latest_col),
        "value": val_f,
    }


def other_csv_inventory() -> list[dict[str, str]]:
    """Light-touch inventory of other CSVs in the folder (no heavy reads)."""
    skip_exact = {
        "supermarket_sales.csv",
        "weatherstats_toronto_daily.csv",
        "CPI_CMA_2006_2024.csv",
        "unemployment_by_CMA_2006_2024.csv",
    }
    inv: list[dict[str, str]] = []
    for name in sorted(os.listdir(DATA_DIR)):
        if not name.lower().endswith(".csv"):
            continue
        if name.startswith("grocery_data_"):
            continue
        if name in skip_exact:
            continue
        path = os.path.join(DATA_DIR, name)
        if not os.path.isfile(path):
            continue
        inv.append({"file": name, "size_mb": round(os.path.getsize(path) / 1_000_000, 2)})
    return inv[:40]


def build_block() -> dict[str, Any]:
    return {
        "source_folder_name": os.path.basename(os.path.normpath(DATA_DIR)),
        "merged_at": datetime.now().isoformat(),
        "grocery_listings_by_month": summarize_grocery_files(),
        "supermarket_sales": summarize_supermarket_sales(),
        "toronto_daily_weather_file": summarize_toronto_weather(),
        "macro_cma": {
            "cpi": wide_latest_toronto("CPI_CMA_2006_2024.csv"),
            "unemployment_rate": wide_latest_toronto("unemployment_by_CMA_2006_2024.csv"),
        },
        "other_csv_inventory": other_csv_inventory(),
    }


def main() -> None:
    if not os.path.isdir(DATA_DIR):
        print(f"SKIP: RETAIL_ANALYTICS_DIR is not a directory: {DATA_DIR}")
        return
    if not os.path.isfile(UNIFIED_PATH):
        print(f"ERROR: {UNIFIED_PATH} not found. Run python 10_unified_signal.py first.")
        raise SystemExit(1)

    with open(UNIFIED_PATH, encoding="utf-8") as f:
        unified: dict[str, Any] = json.load(f)

    block = build_block()
    unified["retail_analytics"] = block

    meta = unified.setdefault("meta", {})
    used = list(meta.get("datasets_used", []))
    tag = f"Local retail_analytics folder ({os.path.basename(DATA_DIR.rstrip(os.sep))})"
    if tag not in used:
        used.append(tag)
    meta["datasets_used"] = used
    meta["retail_analytics_merged_at"] = block["merged_at"]

    with open(UNIFIED_PATH, "w", encoding="utf-8") as f:
        json.dump(unified, f, indent=2, default=str)

    print(f"✓ Merged retail_analytics from:\n  {DATA_DIR}\n→ {UNIFIED_PATH}")
    g = block.get("grocery_listings_by_month") or []
    print(f"  Grocery months summarized: {len(g)}")
    if block.get("supermarket_sales"):
        print("  Supermarket sales summary: yes")
    if block.get("toronto_daily_weather_file"):
        print("  Toronto weatherstats: yes")


if __name__ == "__main__":
    main()
