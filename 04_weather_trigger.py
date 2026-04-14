"""
04_weather_trigger.py
=====================
Pulls the 7-day weather forecast for Mississauga using Open-Meteo
(100% free, no API key required) and checks whether current conditions
match any high-lift Winter product pairs from the market basket analysis.

If a trigger fires, it prints a structured insight payload that you can
pipe into 05_pitch_generator.py to produce the final CPG pitch.

REQUIREMENTS
------------
    pip install requests pandas duckdb

USAGE
-----
    python 04_weather_trigger.py

TRIGGER LOGIC
-------------
A "cold weather" trigger fires when the 3-day average forecast temp is
below COLD_THRESHOLD (°C) AND conditions include snow or heavy rain.
This is when soup, hot beverages, and comfort food baskets spike.
"""

import requests
import json
import pandas as pd
import duckdb
import os
from datetime import datetime, date

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH         = "retail.duckdb"
COLD_THRESHOLD  = 5.0        # °C — below this triggers "cold weather" pitch
RAIN_CODES      = {51,53,55,61,63,65,71,73,75,77,80,81,82,85,86,95,96,99}
# WMO weather codes for rain/snow/thunderstorm (anything wet & miserable)

MISSISSAUGA_LAT = 43.5890
MISSISSAUGA_LON = -79.6441

# ── Step 1: Fetch 7-day forecast from Open-Meteo ──────────────────────────────
def get_forecast(lat: float, lon: float) -> pd.DataFrame:
    """
    Returns a DataFrame with one row per day:
      date, temp_max, temp_min, temp_avg,
      precipitation_sum, weathercode, weather_description
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude"          : lat,
        "longitude"         : lon,
        "daily"             : [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "weathercode",
        ],
        "timezone"          : "America/Toronto",
        "forecast_days"     : 7,
        "temperature_unit"  : "celsius",
        "precipitation_unit": "mm",
    }
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()["daily"]

    df = pd.DataFrame({
        "date"             : pd.to_datetime(data["time"]),
        "temp_max"         : data["temperature_2m_max"],
        "temp_min"         : data["temperature_2m_min"],
        "precipitation_mm" : data["precipitation_sum"],
        "weathercode"      : data["weathercode"],
    })
    df["temp_avg"] = (df["temp_max"] + df["temp_min"]) / 2

    # Human-readable weather descriptions (WMO subset)
    wmo_desc = {
        0:"Clear sky", 1:"Mainly clear", 2:"Partly cloudy", 3:"Overcast",
        45:"Fog", 48:"Icy fog",
        51:"Light drizzle", 53:"Moderate drizzle", 55:"Dense drizzle",
        61:"Light rain", 63:"Moderate rain", 65:"Heavy rain",
        71:"Light snow", 73:"Moderate snow", 75:"Heavy snow", 77:"Snow grains",
        80:"Light showers", 81:"Moderate showers", 82:"Violent showers",
        85:"Light snow showers", 86:"Heavy snow showers",
        95:"Thunderstorm", 96:"Thunderstorm+hail", 99:"Heavy thunderstorm+hail",
    }
    df["weather_desc"] = df["weathercode"].map(wmo_desc).fillna("Unknown")
    return df


# ── Step 2: Evaluate trigger conditions ───────────────────────────────────────
def evaluate_triggers(forecast: pd.DataFrame) -> dict:
    """
    Returns a trigger payload dict with:
      triggered     : bool
      trigger_type  : "cold_wet" | "hot_dry" | "none"
      window_days   : list of dates that are trigger-active
      avg_temp      : 3-day average temperature
      conditions    : list of weather descriptions for trigger window
    """
    # Look at the next 3 days (days 1, 2, 3 — skipping today which is day 0)
    window = forecast.iloc[1:4]
    avg_temp  = window["temp_avg"].mean()
    wet_days  = window[window["weathercode"].isin(RAIN_CODES)]

    if avg_temp < COLD_THRESHOLD and len(wet_days) >= 1:
        return {
            "triggered"   : True,
            "trigger_type": "cold_wet",
            "window_days" : window["date"].dt.strftime("%Y-%m-%d").tolist(),
            "avg_temp"    : round(avg_temp, 1),
            "conditions"  : window["weather_desc"].tolist(),
            "precip_total": round(window["precipitation_mm"].sum(), 1),
        }
    # Future: add hot_dry trigger for cold beverages / BBQ items
    return {
        "triggered"   : False,
        "trigger_type": "none",
        "avg_temp"    : round(avg_temp, 1),
        "conditions"  : window["weather_desc"].tolist(),
    }


# ── Step 3: Pull matching product pairs from DuckDB ───────────────────────────
def get_weather_triggered_pairs(con: duckdb.DuckDBPyConnection,
                                 trigger: dict,
                                 top_n: int = 5) -> pd.DataFrame:
    """
    Hardcoded insight: sub-commodities most often bought in the same basket as SOUP
    (cross-sell companions), ranked by co-occurrence count.
    """
    _ = trigger  # reserved for future trigger-specific filters
    df = con.execute(f"""
        WITH soup_baskets AS (
            SELECT DISTINCT t.basket_id
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE p.commodity_desc = 'SOUP'
        ),
        total_soup AS (
            SELECT COUNT(*) AS n FROM soup_baskets
        )
        SELECT
            'SOUP'                                              AS anchor_product,
            p.sub_commodity_desc                               AS paired_product,
            p.department,
            COUNT(DISTINCT t.basket_id)                        AS co_baskets,
            ROUND(COUNT(DISTINCT t.basket_id) * 100.0 / ts.n, 1) AS pct_of_soup_baskets
        FROM soup_baskets sb
        JOIN transactions t ON sb.basket_id = t.basket_id
        JOIN products p ON t.product_id = p.product_id
        CROSS JOIN total_soup ts
        WHERE p.commodity_desc != 'SOUP'
        GROUP BY p.sub_commodity_desc, p.department, ts.n
        HAVING co_baskets >= 100
        ORDER BY co_baskets DESC
        LIMIT {top_n}
    """).fetchdf()
    return df


# ── Step 4: Build insight payload ─────────────────────────────────────────────
def build_insight_payload(trigger: dict, pairs: pd.DataFrame) -> dict:
    """
    Structures the data for the LLM pitch generator (05_pitch_generator.py).
    """
    top_pair = pairs.iloc[0] if len(pairs) > 0 else None

    payload = {
        "generated_at"   : datetime.now().isoformat(),
        "location"       : "Mississauga, ON",
        "weather_trigger": trigger,
        "top_product_pairs": pairs.to_dict(orient="records"),
        "pitch_context"  : {
            "anchor_product"      : top_pair["anchor_product"] if top_pair is not None else "N/A",
            "paired_product"      : top_pair["paired_product"] if top_pair is not None else "N/A",
            "pct_of_soup_baskets" : float(top_pair["pct_of_soup_baskets"]) if top_pair is not None else 0.0,
            "avg_temp_c"          : trigger["avg_temp"],
            "weather_summary"     : ", ".join(trigger.get("conditions", [])),
        }
    }
    return payload


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  Weather Trigger Engine — Mississauga")
    print("="*60)

    # 1. Fetch forecast
    print(f"\n[1/3] Fetching 7-day forecast for Mississauga...")
    forecast = get_forecast(MISSISSAUGA_LAT, MISSISSAUGA_LON)
    print("\n  7-Day Outlook:")
    print("  " + "-"*50)
    print(forecast[["date","temp_min","temp_max","weather_desc","precipitation_mm"]]
          .to_string(index=False))

    # 2. Evaluate triggers
    print(f"\n[2/3] Evaluating trigger conditions (cold threshold: {COLD_THRESHOLD}°C)...")
    trigger = evaluate_triggers(forecast)

    if trigger["triggered"]:
        print(f"\n  🔔 TRIGGER FIRED: {trigger['trigger_type'].upper()}")
        print(f"     3-day avg temp : {trigger['avg_temp']}°C")
        print(f"     Window         : {', '.join(trigger['window_days'])}")
        print(f"     Conditions     : {', '.join(trigger['conditions'])}")
    else:
        print(f"\n  No trigger conditions met (3-day avg: {trigger['avg_temp']}°C).")
        print("  No pitch will be generated today.")

    # 3. Pull product pairs & build payload (only if triggered)
    if trigger["triggered"]:
        if not os.path.exists(DB_PATH):
            print(f"\n  ⚠  {DB_PATH} not found. Run 02_load_data.py first.")
            return

        print(f"\n[3/3] Pulling SOUP basket companions from DuckDB...")
        con = duckdb.connect(DB_PATH, read_only=True)

        try:
            pairs = get_weather_triggered_pairs(con, trigger)
            print("\n  Top SOUP basket companions:")
            print("  " + "-"*50)
            print(pairs.to_string(index=False))

            payload = build_insight_payload(trigger, pairs)

            # Save payload for pitch generator
            payload_path = os.path.join("output", "trigger_payload.json")
            os.makedirs("output", exist_ok=True)
            with open(payload_path, "w") as f:
                json.dump(payload, f, indent=2)

            print(f"\n  Payload saved → {payload_path}")
            print("  Next: run 05_pitch_generator.py to draft the CPG pitch.")

        except Exception as e:
            print(f"\n  Could not query DuckDB for SOUP companions: {e}")
            print("  Ensure retail.duckdb exists (run 02_load_data.py).")
        finally:
            con.close()

    print("\n" + "="*60)
    print("  Weather check complete.")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
