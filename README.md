<div align="center">

# CPG Insight Engine

### Weather-Aware Retail Analytics for Consumer Packaged Goods

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![DuckDB](https://img.shields.io/badge/DuckDB-Analytical_DB-FFF000?logo=duckdb&logoColor=black)](https://duckdb.org/)
[![Express](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-History_Store-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?logo=render&logoColor=white)](https://render.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Automated-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![Groq](https://img.shields.io/badge/Groq-LLM_Inference-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**$0 Stack** &nbsp;|&nbsp; Dunnhumby + DuckDB + Open-Meteo + Groq LLM + GitHub Actions

[**Live Demo**](https://cpg-insight-engine.onrender.com) &nbsp;&middot;&nbsp; [**Repository**](https://github.com/nikhiljha97/cpg-insight-engine)

</div>

---

## The Problem

CPG brand managers and grocery retailers struggle to know **when** and **how** to activate promotions. Weather is a proven demand driver — cold and wet conditions increase sales of soup, comfort food, and hot beverages — but most retailers lack automated systems that connect weather forecasts to basket-level purchase data to produce actionable recommendations.

**CPG Insight Engine** bridges that gap. It monitors real-time weather across 15+ Canadian cities, detects cold/wet trigger conditions, analyses 200M+ rows of transaction data for basket companions, promotional lift, price elasticity, and buyer demographics, then generates a data-driven executive pitch via LLM — fully automated, zero cost.

---

## Key Findings

| Insight | Signal | Implication |
|:--------|:-------|:------------|
| **48%** of soup baskets include Fluid Milk | Basket co-occurrence | Strongest cross-category bundle opportunity for end-cap placement |
| **4.6x** lift from Display + Mailer combined | Promo attribution (Cold Cereal) | Multi-channel activation vastly outperforms single-tactic |
| **-0.246** elasticity for Cold Cereal (Upscale) | Price elasticity | Inelastic — price increases won't hurt volume in premium stores |
| **-1.339** elasticity for Bag Snacks (Value) | Price elasticity | Highly elastic — price-sensitive buyers require careful discount strategy |
| **30.6%** coupon redemption rate | Frozen Grocery buyers | Highest of any department — coupon programs drive clear ROI here |
| **MAINSTREAM** tier shows highest activation ROI | Store tier analysis | Prioritize mainstream stores for promotional investment |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│                                                                     │
│   Dunnhumby Datasets (4)          Open-Meteo API                   │
│   ┌──────────────────┐            ┌──────────────┐                 │
│   │ Complete Journey  │            │ 7-day forecast│                │
│   │ Carbo-Loading     │            │ 15+ CA cities │                │
│   │ Breakfast at Frat │            └──────┬───────┘                 │
│   │ Let's Get Sort-of │                   │                         │
│   │   -Real           │                   │                         │
│   └────────┬─────────┘                    │                         │
│            │                              │                         │
│            ▼                              ▼                         │
│   ┌────────────────┐           ┌──────────────────┐                │
│   │    DuckDB       │           │  Weather Trigger  │               │
│   │  200M+ rows     │           │  cold < 12°C AND  │               │
│   │  in-process SQL │           │  wet days > 0     │               │
│   └────────┬───────┘            └──────────┬───────┘               │
└────────────┼───────────────────────────────┼───────────────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ANALYSIS LAYER (Python)                        │
│                                                                     │
│   03 Market Basket ──► 07 Promo Attribution ──► 08 Price Elasticity │
│          │                      │                       │           │
│          ▼                      ▼                       ▼           │
│   09 Demographics ────────► 10 Unified Signal (JSON) ◄─┘           │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                              │
│                                                                     │
│   ┌──────────────────────┐    ┌──────────────────────┐             │
│   │  Express.js API       │◄──│  Pre-computed JSONs   │             │
│   │  (TypeScript, :4000)  │    └──────────────────────┘             │
│   │  REST + NLQ + StatCan │                                         │
│   └──────────┬───────────┘                                         │
│              │                                                      │
│              ▼                                                      │
│   ┌──────────────────────┐    ┌──────────────────────┐             │
│   │  React Dashboard      │───►│  Groq LLM            │             │
│   │  (Vite, dark theme)   │    │  llama-3.3-70b       │             │
│   └──────────────────────┘    └──────────────────────┘             │
│              │                         │                            │
│              ▼                         ▼                            │
│   ┌──────────────────────────────────────────┐                     │
│   │          SQLite (Pitch History)           │                     │
│   └──────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DEPLOYMENT                                    │
│                                                                     │
│   Render.com (free tier)         GitHub Actions                     │
│   ├─ Backend: Web Service        └─ Cron: Mon-Fri 8AM ET           │
│   └─ Frontend: Static Site         Weather check + pitch gen        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Pages

The SPA lives under `cpg-dashboard/` and uses **hash routes** (for example `/#/dashboard`, `/#/forecast`). A fixed **left nav** lists primary pages; an **Insights Assistant** tab on the right opens a drawer with multi-turn **NLQ** (Groq-backed when `GROQ_API_KEY` is set on the API) and **Export PDF** (category-scoped insight pack).

| Route | Page | Description |
|:------|:-----|:------------|
| `/#/` | **About** | Product overview and how signals fit together |
| `/#/dashboard` | **Dashboard** | Weather lane KPIs, demand category ↔ Ontario retail (StatCan vector per category), macro strip, GTA traffic |
| `/#/basket` | **Basket Analysis** | Companion products and lift for the selected food category (synced with dashboard category) |
| `/#/history` | **Pitch History** | Saved pitches from SQLite |
| `/#/promo` | **Promo Attribution** | Promo lift by category and store tier |
| `/#/elasticity` | **Price Elasticity** | Elasticity, discount depth, store tier summary |
| `/#/demographics` | **Demographics** | Segment penetration, spend trajectory, coupon usage |
| `/#/forecast` | **Demand Forecast** | Category demand index trail + short horizon |
| `/#/esg` | **ESG Insights** | Curated ESG / reporting links and notes |
| `/#/sentiment` | **Brand Sentiment** | *Temporarily disabled in the UI* (see below) |

### Brand Sentiment (optional in UI)

The Reddit-based **Brand Sentiment** page and nav item are **off by default** so shipping does not depend on that surface. The implementation (`cpg-dashboard/src/pages/BrandSentiment.tsx`) and API (`GET /api/sentiment/reddit-grocery`) remain in the repo.

- **Turn it back on:** in `cpg-dashboard/src/App.tsx`, set `ENABLE_BRAND_SENTIMENT_PAGE` to `true` (rebuild / redeploy).
- **While disabled:** there is no sidebar link; visiting `/#/sentiment` **redirects to** `/#/dashboard`.

---

## Datasets

All datasets sourced from [dunnhumby Source Files](https://www.dunnhumby.com/source-files/).

| Dataset | Scale | Coverage | Role in Project |
|:--------|:------|:---------|:----------------|
| **The Complete Journey** | 2,595,732 transactions, 8 tables | 2,500 households, 2 years | Basket analysis, demographic segmentation, coupon effectiveness |
| **Carbo-Loading** | 5,197,681 transactions | Pasta, Pasta Sauce, Syrup, Pancake Mix | Category cross-promo lift, causal (display/mailer) attribution |
| **Breakfast at the Frat** | 524,950 rows | 156 weeks, 79 stores, 4 categories | Price elasticity curves, store tier analysis (Value/Mainstream/Upscale) |
| **Let's Get Sort-of-Real** | 300M+ transactions | 500K customers, 760 stores, 117 weeks | Customer segmentation (seg_1/seg_2 clusters), basket mission analysis |

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Analytical DB** | DuckDB | In-process SQL engine for 200M+ rows — no server needed |
| **Data Pipeline** | Python (pandas, numpy, duckdb) | 10 scripts for loading, analysis, and signal generation |
| **Weather** | Open-Meteo API | Free weather API (no key), 7-day forecast for Canadian cities |
| **LLM Inference** | Groq (llama-3.3-70b-versatile) | Executive pitch generation combining all analytical signals |
| **Backend** | Express.js 5 + TypeScript | API on port 4000 — weather, StatCan Ontario retail (per demand category), basket, NLQ, demand forecast, Reddit sentiment snapshot, PDF bundle, etc. |
| **Frontend** | React 19 + Vite | Hash-routed dashboard, **Insights Assistant** right rail (NLQ + consolidated PDF export) |
| **Local Storage** | SQLite (better-sqlite3) | Pitch history persistence |
| **CI/CD** | GitHub Actions | Push/PR CI (Python syntax + dashboard build + Playwright), scheduled data pipeline, optional cache refresh cron |
| **Hosting** | Render.com (free tier) | Backend as Web Service, frontend as Static Site |

---

## Pipeline Scripts

```
python_scripts/
├── 01_schema.sql                  # DuckDB DDL for 7 Complete Journey tables
├── 02_load_data.py                # Load all Dunnhumby CSVs into DuckDB
├── 03_market_basket.py            # Co-occurrence analysis, lift scores, seasonal breakdown
├── 04_weather_trigger.py          # Open-Meteo forecast + cold/wet trigger evaluation
├── 05_pitch_generator.py          # Groq LLM pitch draft, saves to file
├── 06_load_extended_data.py       # Load Breakfast at Frat, Carbo-Loading, LGSR into DuckDB
├── 07_promo_attribution.py        # Display vs. mailer vs. TPR lift by category & store tier
├── 08_price_elasticity.py         # Log-log regression for price elasticity coefficients
├── 09_demographic_segmentation.py # Soup buyer profiles by income/age/kids/homeowner
└── 10_unified_signal.py           # Merge all outputs → unified_signal.json
```

### Trigger Logic

| Condition | Threshold | Source |
|:----------|:----------|:-------|
| 3-day average temperature | < 12 °C | Open-Meteo API |
| Wet weather days (rain/snow) | ≥ 1 of 3 days | Open-Meteo weather codes |
| Season mapping | Auto-detected | Mapped to seasonal lift table |

> Adjust `COLD_THRESHOLD` in `04_weather_trigger.py` to tune trigger sensitivity.

---

## Getting Started

### Prerequisites

- **Python 3.11+** (matches CI); **3.12+** recommended locally
- **Node.js 20+** and **npm** (dashboard uses Node **22** in CI)
- **Groq API key** (free at [console.groq.com](https://console.groq.com))

### 1. Clone the Repository

```bash
git clone https://github.com/nikhiljha97/cpg-insight-engine.git
cd cpg-insight-engine
```

### 2. Set Up the Python Environment

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

### 3. Download Dunnhumby Datasets

Download the following datasets from [dunnhumby.com/source-files](https://www.dunnhumby.com/source-files/) (or Kaggle equivalents) and place the extracted CSV/XLSX files either **in the project root** or in **one folder** (for example your Desktop).

- The Complete Journey
- Carbo-Loading
- Breakfast at the Frat
- Let's Get Sort-of-Real

If the files live outside the repo (e.g. `~/Desktop`), set **`CPG_DATA_DIR`** before running the loaders (both scripts read the same variable):

```bash
export CPG_DATA_DIR="$HOME/Desktop"
# or: export CPG_DATA_DIR="$HOME/Desktop/dunnhumby-data"
```

### 4. Build the Analytical Database

```bash
# Load core Complete Journey data
python 02_load_data.py

# Load extended datasets (Breakfast at Frat, Carbo-Loading, LGSR)
python 06_load_extended_data.py
```

This creates `retail.duckdb` locally. Takes approximately 1–2 minutes for the full dataset.

### 5. Run the Analysis Pipeline

```bash
# Market basket analysis — co-occurrence, lift scores, seasonal patterns
python 03_market_basket.py

# Promotional attribution — display vs. mailer vs. TPR lift
python 07_promo_attribution.py

# Price elasticity — log-log regression by category and store tier
python 08_price_elasticity.py

# Demographic segmentation — buyer profiles by income/age/kids
python 09_demographic_segmentation.py

# Export retail_analytics CSV summaries to JSON (same pattern as promo_attribution)
python 12_export_retail_analytics_json.py

# Merge all signals into a single JSON (includes retail_analytics if output/retail_analytics.json exists)
python 10_unified_signal.py

# If unified_signal.json already exists and you only updated retail CSVs:
# re-merge from output/retail_analytics.json without rebuilding Dunnhumby signals.
python 11_merge_retail_analytics.py
```

Or run the guarded runner (skips 02–10 when Dunnhumby CSVs are absent so
committed `output/*.json` is not wiped; always runs **12** (retail JSON) then **10** or **11** + **04**):

```bash
python scripts/run_pipeline.py
# or: make pipeline
```

### Scheduled data refresh (`pipeline.yml`)

You do not need to run each Python step by hand for routine JSON refreshes.

- **`.github/workflows/pipeline.yml`** runs **`python scripts/run_pipeline.py`** on a **daily schedule** (06:15 UTC) and on **manual “Run workflow”**. If any committed **`output/*.json`** files change, the workflow **commits and pushes** them (message includes **`[skip ci]`** so the push/PR CI job is not re-fired for that commit).
- **Optional secrets** (repo → *Settings → Secrets and variables → Actions*), if CSVs live in private git mirrors:
  - **`CPG_DATA_CLONE_URL`** — `git clone` URL whose root contains `transaction_data.csv`, `product.csv`, etc. (sets **`CPG_DATA_DIR`** for the job).
  - **`RETAIL_ANALYTICS_CLONE_URL`** — `git clone` URL whose root contains `grocery_data_*.csv` and related files (sets **`RETAIL_ANALYTICS_DIR`**).
- For private clones, embed a **fine-scoped PAT** in the HTTPS URL or use a deploy key; see GitHub’s docs on cloning with authentication in Actions.
- If **`main`** is **branch-protected** against direct pushes, allow **GitHub Actions** to push (or use a bypass rule); otherwise the commit step will fail while the pipeline itself still ran.

CI, daily pitch, and Render cache refresh are summarized under **[GitHub Actions workflows](#github-actions-workflows)** below.

### 6. Test the Weather Trigger

```bash
python 04_weather_trigger.py
```

Pulls the live forecast for Canadian cities. If the cold/wet trigger fires, the payload is saved to `output/trigger_payload.json`.

### 7. Generate an Executive Pitch

```bash
export GROQ_API_KEY="your_key_from_console.groq.com"
python 05_pitch_generator.py
```

### 8. Start the Dashboard

From `cpg-dashboard/` after `npm install`:

```bash
# Terminal 1 — Express API (default http://127.0.0.1:4000)
npm run dev

# Terminal 2 — Vite dev server (see vite.config.ts: port 3000, /api proxied to :4000)
npx vite
```

Open [http://localhost:3000](http://localhost:3000) in your browser (not 5173 — the dev server port is set to **3000** in `cpg-dashboard/vite.config.ts`).

For a **production-like** single port after `npm run build`, use `npx vite preview --host 127.0.0.1 --port 4173` with the API still on **4000** (Vite preview proxies `/api` to `127.0.0.1:4000` — same pattern as `cpg-dashboard/scripts/e2e.sh`).

**Headless UAT:** from `cpg-dashboard`, run `npm run test:e2e` — it builds the client, starts the API and `vite preview`, then runs Playwright (upstream APIs are **stubbed** in `e2e/api-mocks.ts` for speed and determinism). **`CI=true`** in GitHub Actions enables one retry on flake.

---

## GitHub Actions workflows

| Workflow | File | When | What it does |
|:---------|:-----|:-----|:---------------|
| **CI** | `.github/workflows/ci.yml` | Push / PR to `main` | **python-pipeline:** `py_compile` on key scripts · **dashboard-build:** `npm ci`, `npm run build`, Playwright `bash scripts/e2e.sh` |
| **Analytics pipeline** | `.github/workflows/pipeline.yml` | Daily 06:15 UTC + manual | Runs `python scripts/run_pipeline.py`; may commit `output/*.json` with `[skip ci]` |
| **Daily weather + pitch** | `.github/workflows/daily_trigger.yml` | Mon–Fri 13:00 UTC | Weather check; optional Groq pitch; artifact upload |
| **API cache refresh** | `.github/workflows/refresh_data.yml` | Every 4h + manual | Wakes Render API and calls `POST /api/internal/refresh-caches` when `DATA_REFRESH_SECRET` is set |

Action pins use current majors (**`actions/checkout@v6`**, **`actions/setup-python@v6`**, **`actions/setup-node@v6`**) so JavaScript actions run on the **Node 24** runtime supported by GitHub (avoids Node 20 deprecation warnings).

**Secrets (examples):**

- **`GROQ_API_KEY`** — for `daily_trigger.yml` pitch generation.
- **`DATA_REFRESH_SECRET`** — same value as on the Render **Web** service for `refresh_data.yml`.
- **`CPG_DATA_CLONE_URL`** / **`RETAIL_ANALYTICS_CLONE_URL`** — optional private CSV mirrors for `pipeline.yml` (documented above).

> Free tier: 2,000 Actions minutes/month. The daily trigger uses ~2 min per run when the pitch path runs.

---

## Project Structure

```
cpg-insight-engine/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Python compile + dashboard build + Playwright
│       ├── pipeline.yml          # Scheduled / manual data pipeline + output commit
│       ├── daily_trigger.yml     # Weekday weather + optional pitch artifact
│       └── refresh_data.yml      # Periodic Render cache warm (DATA_REFRESH_SECRET)
├── cpg-dashboard/                  # Full-stack dashboard application
│   ├── src/                        # React frontend (Vite)
│   └── server/                     # Express.js + TypeScript backend
├── output/                         # Pre-computed analysis JSONs
├── python_scripts/                 # Data pipeline (referenced above)
├── 01_schema.sql                   # DuckDB DDL
├── 02_load_data.py                 # Data loader (core)
├── 03_market_basket.py             # Basket analysis
├── 04_weather_trigger.py           # Weather trigger
├── 05_pitch_generator.py           # LLM pitch generation
├── 06_load_extended_data.py        # Extended data loader
├── 07_promo_attribution.py         # Promo attribution
├── 08_price_elasticity.py          # Price elasticity
├── 09_demographic_segmentation.py  # Demographics
├── 10_unified_signal.py            # Signal merger
├── requirements.txt                # Python dependencies
└── README.md
```

---

## How It Works — End to End

```
1. INGEST        Dunnhumby CSVs → DuckDB (200M+ rows, in-process)
                         │
2. ANALYSE       Market basket → Promo lift → Elasticity → Demographics
                         │
3. MERGE         All signals → unified_signal.json
                         │
4. MONITOR       Open-Meteo API → 15+ Canadian cities → cold/wet trigger
                         │
5. GENERATE      Groq LLM (llama-3.3-70b) → executive CPG pitch
                         │
6. SERVE         Express API → React dashboard → pitch history (SQLite)
                         │
7. AUTOMATE      GitHub Actions → Mon-Fri 8AM ET → full pipeline
```

---

## Author

**Nikhil Jha** — MBA Finance

Built as a portfolio piece demonstrating end-to-end data engineering, retail analytics, and LLM-powered insight generation.

[![GitHub](https://img.shields.io/badge/GitHub-nikhiljha97-181717?logo=github&logoColor=white)](https://github.com/nikhiljha97)

---

<div align="center">

*Built with open data from [dunnhumby](https://www.dunnhumby.com/source-files/), free weather from [Open-Meteo](https://open-meteo.com/), and LLM inference from [Groq](https://groq.com/).*

</div>
