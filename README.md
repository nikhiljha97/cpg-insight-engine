<div align="center">

# CPG Insight Engine

### Weather-Aware Retail Analytics for Consumer Packaged Goods

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![DuckDB](https://img.shields.io/badge/DuckDB-Analytical_DB-FFF000?logo=duckdb&logoColor=black)](https://duckdb.org/)
[![Express](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
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
│   │  8 routes             │                                         │
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

| # | Page | Description |
|:-:|:-----|:------------|
| 1 | **Weather Trigger** | City selector for 15+ Canadian cities, 7-day forecast visualization, KPI cards, one-click pitch generation |
| 2 | **Basket Analysis** | SOUP companion products, top cross-department pairs, co-occurrence lift scores |
| 3 | **Pitch History** | Saved executive pitches from SQLite with trend tracking |
| 4 | **Promo Attribution** | Display vs. mailer vs. TPR lift by category and store tier |
| 5 | **Price Elasticity** | Elasticity curves, discount depth analysis, store tier comparison |
| 6 | **Buyer Profiles** | Demographic penetration, spend trajectory, coupon usage by segment |

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
| **Backend** | Express.js + TypeScript | API server on port 4000, 8 routes serving pre-computed analytics |
| **Frontend** | React + Vite | Dashboard with dark navy/teal analytics theme |
| **Local Storage** | SQLite (better-sqlite3) | Pitch history persistence |
| **CI/CD** | GitHub Actions | Daily cron Mon–Fri 8 AM ET: weather trigger + pitch generation |
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

- **Python 3.12+**
- **Node.js 18+** and **npm**
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

# Merge all signals into a single JSON
python 10_unified_signal.py
```

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

```bash
# Backend (Express.js API)
cd cpg-dashboard
npm install
npm run dev          # Starts on port 4000

# Frontend (React + Vite) — in a separate terminal
cd cpg-dashboard
npm run dev:client   # Starts Vite dev server
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Automation (GitHub Actions)

The workflow at `.github/workflows/daily_trigger.yml` runs automatically **Monday through Friday at 8:00 AM ET**.

Each run:
1. Checks the weather forecast for monitored Canadian cities
2. Evaluates the cold/wet trigger condition
3. If triggered, generates an LLM-powered executive pitch
4. Saves the pitch as a downloadable artifact in the Actions tab

**Setup:**
1. Push the repo to GitHub
2. Add your API key as a repository secret: `Settings → Secrets → Actions → New secret → GROQ_API_KEY`
3. The workflow activates automatically

> Free tier: 2,000 min/month. Each run takes ~2 min → approximately 44 automated runs per month.

---

## Project Structure

```
cpg-insight-engine/
├── .github/
│   └── workflows/
│       └── daily_trigger.yml       # GitHub Actions cron job
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
