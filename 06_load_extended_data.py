"""
06_load_extended_data.py
Load all extended datasets into retail.duckdb:
  - Breakfast at the Frat (Excel: 3 sheets)
  - Carbo-Loading (3 CSVs)
  - Let's Get Sort-of-Real (CSV parts)

Run from the repo root (same place as retail.duckdb).

Optional: put all CSV/XLSX on Desktop (or any folder) and run:
  export CPG_DATA_DIR=~/Desktop
  python 06_load_extended_data.py
"""
import duckdb
import pandas as pd
import os
import glob

DB_PATH = "retail.duckdb"
DATA_ROOT = os.path.abspath(os.path.expanduser(os.environ.get("CPG_DATA_DIR", ".")))


def _glob_data(patterns):
    paths = []
    for pat in patterns:
        paths.extend(glob.glob(os.path.join(DATA_ROOT, pat)))
    return sorted(set(paths))


con = duckdb.connect(DB_PATH)

print(f"\n  Extended data CSV/XLSX directory: {DATA_ROOT}\n")

# ── 1. BREAKFAST AT THE FRAT ─────────────────────────────────────────────────
EXCEL_PATH = os.path.join(DATA_ROOT, "dunnhumby-Breakfast-at-the-Frat.xlsx")
if os.path.exists(EXCEL_PATH):
    print("=== Loading Breakfast at the Frat ===")
    xl = pd.ExcelFile(EXCEL_PATH)

    # Store lookup
    stores = xl.parse("dh Store Lookup", header=1).dropna(subset=["STORE_ID"])
    stores.columns = stores.columns.str.strip().str.upper()
    con.execute("DROP TABLE IF EXISTS batf_store_lookup")
    con.execute("CREATE TABLE batf_store_lookup AS SELECT * FROM stores")
    print(f"  batf_store_lookup:   {len(stores):,} rows")

    # Product lookup
    prods = xl.parse("dh Products Lookup", header=1).dropna(subset=["UPC"])
    prods.columns = prods.columns.str.strip().str.upper()
    con.execute("DROP TABLE IF EXISTS batf_product_lookup")
    con.execute("CREATE TABLE batf_product_lookup AS SELECT * FROM prods")
    print(f"  batf_product_lookup: {len(prods):,} rows")

    # Transactions
    print("  Loading batf_transactions (~682K rows)...")
    txn = xl.parse("dh Transaction Data", header=1).dropna(subset=["UPC"])
    txn.columns = txn.columns.str.strip().str.upper()
    txn["WEEK_END_DATE"] = pd.to_datetime(txn["WEEK_END_DATE"])
    con.execute("DROP TABLE IF EXISTS batf_transactions")
    con.execute("CREATE TABLE batf_transactions AS SELECT * FROM txn")
    print(f"  batf_transactions:   {len(txn):,} rows")
else:
    print(f"SKIP: {EXCEL_PATH} not found")

# ── 2. CARBO-LOADING ─────────────────────────────────────────────────────────
print("\n=== Loading Carbo-Loading ===")

if os.path.exists(os.path.join(DATA_ROOT, "dh_product_lookup.csv")):
    cp = pd.read_csv(os.path.join(DATA_ROOT, "dh_product_lookup.csv"))
    con.execute("DROP TABLE IF EXISTS carbo_product_lookup")
    con.execute("CREATE TABLE carbo_product_lookup AS SELECT * FROM cp")
    print(f"  carbo_product_lookup: {len(cp):,} rows")

if os.path.exists(os.path.join(DATA_ROOT, "dh_causal_lookup.csv")):
    cc = pd.read_csv(os.path.join(DATA_ROOT, "dh_causal_lookup.csv"))
    con.execute("DROP TABLE IF EXISTS carbo_causal_lookup")
    con.execute("CREATE TABLE carbo_causal_lookup AS SELECT * FROM cc")
    print(f"  carbo_causal_lookup:  {len(cc):,} rows")

if os.path.exists(os.path.join(DATA_ROOT, "dh_transactions.csv")):
    print("  Loading dh_transactions.csv (~5.2M rows, takes ~60s)...")
    ct = pd.read_csv(os.path.join(DATA_ROOT, "dh_transactions.csv"))
    con.execute("DROP TABLE IF EXISTS carbo_transactions")
    con.execute("CREATE TABLE carbo_transactions AS SELECT * FROM ct")
    print(f"  carbo_transactions:   {len(ct):,} rows")
else:
    print("  SKIP: dh_transactions.csv not found")

# ── 3. LET'S GET SORT-OF-REAL ────────────────────────────────────────────────
print("\n=== Loading Let's Get Sort-of-Real ===")

# Try sample files first, then full parts (all under DATA_ROOT)
sample_files = _glob_data(
    [
        "*50k*customers*.csv",
        "*50K*customers*.csv",
        "sample_50k*.csv",
        "5000-customers*.csv",
        "50000-customers*.csv",
    ]
)
part_files = _glob_data(
    [
        "*part*.csv",
        "*Part*.csv",
        "lets-get-sort-of-real-part*.csv",
    ]
)

lgsr_files = sample_files if sample_files else part_files

if lgsr_files:
    print(f"  Found {len(lgsr_files)} file(s): {lgsr_files[:3]}")
    first = True
    total = 0
    con.execute("DROP TABLE IF EXISTS lgsr_transactions")
    for i, f in enumerate(lgsr_files):
        print(f"  Loading {f}...")
        chunk = pd.read_csv(f, low_memory=False)
        chunk.columns = chunk.columns.str.strip().str.lower()
        if first:
            con.execute("CREATE TABLE lgsr_transactions AS SELECT * FROM chunk")
            first = False
        else:
            con.execute("INSERT INTO lgsr_transactions SELECT * FROM chunk")
        total += len(chunk)
        print(f"    +{len(chunk):,} rows (total so far: {total:,})")
    print(f"  lgsr_transactions: {total:,} rows total")
else:
    print("  SKIP: No Let's Get Sort-of-Real files found")
    print("  Expected filenames like: 50000-customers.csv or lets-get-sort-of-real-part-1.csv")

con.close()
print("\n✓ All extended data loaded into retail.duckdb")
