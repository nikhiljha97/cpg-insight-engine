# Retail Analytics — CPG Proactive Insight Engine
### $0 Stack | Dunnhumby + DuckDB + Open-Meteo + Groq/Gemini + GitHub Actions

---

## What This Does
Automatically checks the Mississauga weather forecast every weekday morning.
When cold/wet conditions are detected, it queries your local DuckDB database for
product pairs that historically spike during that weather, then drafts a
"Proactive Insight Proposal" for a CPG brand manager — fully automated, zero cost.

---

## File Map

| File | Purpose |
|------|---------|
| `01_schema.sql` | DuckDB table definitions (run once) |
| `02_load_data.py` | Load Dunnhumby CSVs into DuckDB |
| `03_market_basket.py` | Co-occurrence analysis + seasonal lift |
| `04_weather_trigger.py` | Open-Meteo forecast + trigger evaluation |
| `05_pitch_generator.py` | LLM pitch draft via Groq or Gemini |
| `.github/workflows/daily_trigger.yml` | GitHub Actions cron (Mon–Fri 8am ET) |

---

## Setup (One-Time)

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Download the dataset
Go to [Kaggle — Dunnhumby The Complete Journey](https://www.kaggle.com/datasets/frtgnn/dunnhumby-the-complete-journey)
and download all CSVs into this folder.

### 3. Load data into DuckDB
```bash
python 02_load_data.py
```
This creates `retail.duckdb` locally. Takes ~1–2 min on the full dataset.

### 4. Run Market Basket Analysis
```bash
python 03_market_basket.py
```
Outputs `output/product_pairs.csv` and `output/seasonal_lift.csv`.

### 5. Test the weather trigger
```bash
python 04_weather_trigger.py
```
Pulls live Mississauga forecast. If trigger fires → saves `output/trigger_payload.json`.

### 6. Generate a pitch (need one free API key)

**Option A — Groq** (recommended, fastest):
```bash
export GROQ_API_KEY="your_key_from_console.groq.com"
python 05_pitch_generator.py
```

**Option B — Gemini**:
```bash
export GEMINI_API_KEY="your_key_from_aistudio.google.com"
python 05_pitch_generator.py
```

---

## Automation (GitHub Actions)

1. Push this repo to GitHub
2. Add your API key as a repo secret:
   `Settings → Secrets → Actions → New secret → GROQ_API_KEY`
3. The workflow fires every weekday at 8:00 AM ET automatically
4. Pitches are saved as downloadable artifacts in the Actions tab

Free tier: 2,000 min/month. Each run ≈ 2 min → ~44 free automated runs/month.

---

## Trigger Logic

| Condition | Threshold |
|-----------|-----------|
| 3-day avg temp | < 5°C |
| Wet weather days | ≥ 1 of 3 days (rain/snow codes) |
| Season mapped to | Winter lift table |

Adjust `COLD_THRESHOLD` in `04_weather_trigger.py` to tune sensitivity.

---

## Data Source
[Dunnhumby — The Complete Journey](https://www.kaggle.com/datasets/frtgnn/dunnhumby-the-complete-journey)
2,500 households | 2 years | ~275,000 baskets | 7 tables
