"""
02_load_data.py
===============
Loads all Dunnhumby "The Complete Journey" CSV files into a local
DuckDB database file (retail.duckdb).

USAGE
-----
1. Download the dataset from Kaggle:
   https://www.kaggle.com/datasets/frtgnn/dunnhumby-the-complete-journey
2. Unzip all CSVs into the same folder as this script  (or update DATA_DIR).
3. Run:  python 02_load_data.py

REQUIREMENTS
------------
    pip install duckdb pandas
"""

import os
import time
import duckdb
import pandas as pd

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH   = "retail.duckdb"          # DuckDB file created in current directory
DATA_DIR  = "."                      # Folder containing the CSVs
SCHEMA_FILE = "01_schema.sql"        # DDL file from step 1

# Kaggle CSV filenames → target DuckDB table names
FILE_MAP = {
    "transaction_data.csv"  : "transactions",
    "product.csv"           : "products",
    "hh_demographic.csv"    : "households",
    "campaign_table.csv"    : "campaign_table",
    "campaign_desc.csv"     : "campaign_desc",
    "coupon.csv"            : "coupons",
    "coupon_redempt.csv"    : "coupon_redempt",
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase column names and strip whitespace."""
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df


def load_csv(con: duckdb.DuckDBPyConnection, csv_path: str, table: str) -> int:
    """
    Read CSV into pandas, normalise columns, then register as a DuckDB
    relation and INSERT INTO the target table.  Returns row count.
    """
    print(f"  Loading {os.path.basename(csv_path)} → {table} ...", end=" ", flush=True)
    t0 = time.time()

    df = pd.read_csv(csv_path, low_memory=False)
    df = normalise_columns(df)

    # Register the dataframe so DuckDB can query it directly
    con.register("_staging", df)
    con.execute(f"INSERT INTO {table} SELECT * FROM _staging")
    con.unregister("_staging")

    elapsed = time.time() - t0
    rows = len(df)
    print(f"{rows:,} rows  ({elapsed:.1f}s)")
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'='*60}")
    print("  Dunnhumby Retail Analytics — Data Loader")
    print(f"{'='*60}\n")

    # 1. Connect (creates file if it doesn't exist)
    con = duckdb.connect(DB_PATH)
    print(f"Database: {os.path.abspath(DB_PATH)}\n")

    # 2. Execute schema DDL
    print("Creating schema...")
    with open(SCHEMA_FILE, "r") as f:
        schema_sql = f.read()
    con.execute(schema_sql)
    print("  Schema applied.\n")

    # 3. Load each CSV
    total_rows = 0
    missing = []

    for filename, table in FILE_MAP.items():
        csv_path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(csv_path):
            print(f"  ⚠  {filename} not found — skipping.")
            missing.append(filename)
            continue
        total_rows += load_csv(con, csv_path, table)

    # 4. Summary
    print(f"\n{'─'*60}")
    print(f"  Loaded {total_rows:,} total rows into {DB_PATH}")

    if missing:
        print(f"\n  Missing files (skipped):")
        for f in missing:
            print(f"    • {f}")
        print("  Download from: https://www.kaggle.com/datasets/frtgnn/dunnhumby-the-complete-journey")

    # 5. Quick sanity check
    print(f"\n  Row counts per table:")
    for _, table in FILE_MAP.items():
        try:
            n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"    {table:<25} {n:>12,}")
        except Exception:
            print(f"    {table:<25} {'(empty)':>12}")

    con.close()
    print(f"\n{'='*60}")
    print("  Done. Run 03_market_basket.py next.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
