import express from "express";
import Database from "better-sqlite3";
import Groq from "groq-sdk";
import fs from "node:fs";
import path from "node:path";

type City = {
  name: string;
  lat: number;
  lon: number;
};

type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  tempAvg: number;
  precipitationMm: number;
  weatherCode: number;
  weatherLabel: string;
  inTriggerWindow: boolean;
};

const PORT = 4000;
const WEATHER_THRESHOLD = 12;
const DB_PATH = "cpg.db";
const UNIFIED_SIGNAL_PATH = path.join(process.cwd(), "..", "output", "unified_signal.json");

const cities: City[] = [
  { name: "Mississauga", lat: 43.589, lon: -79.6441 },
  { name: "Toronto", lat: 43.6532, lon: -79.3832 },
  { name: "Vancouver", lat: 49.2827, lon: -123.1207 },
  { name: "Montreal", lat: 45.5017, lon: -73.5673 },
  { name: "Calgary", lat: 51.0447, lon: -114.0719 },
  { name: "Ottawa", lat: 45.4215, lon: -75.6972 },
  { name: "Edmonton", lat: 53.5461, lon: -113.4938 },
  { name: "Winnipeg", lat: 49.8951, lon: -97.1384 },
  { name: "Halifax", lat: 44.6488, lon: -63.5752 },
  { name: "Quebec City", lat: 46.8139, lon: -71.208 },
  { name: "Hamilton", lat: 43.2557, lon: -79.8711 },
  { name: "Victoria", lat: 48.4284, lon: -123.3656 },
  { name: "Saskatoon", lat: 52.1332, lon: -106.67 },
  { name: "St. John's", lat: 47.5615, lon: -52.7126 },
  { name: "Kelowna", lat: 49.888, lon: -119.496 }
];

const wmo: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Moderate showers",
  82: "Violent showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Heavy thunderstorm with hail"
};

const wetCodes = new Set([51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

const basketData = {
  soupCompanions: [
    { pairedProduct: "Fluid Milk", pctOfSoupBaskets: 48.0 },
    { pairedProduct: "Bananas", pctOfSoupBaskets: 29.0 },
    { pairedProduct: "White Bread", pctOfSoupBaskets: 25.6 },
    { pairedProduct: "Shredded Cheese", pctOfSoupBaskets: 23.2 },
    { pairedProduct: "Soft Drinks", pctOfSoupBaskets: 19.5 },
    { pairedProduct: "Orange Juice", pctOfSoupBaskets: 15.6 },
    { pairedProduct: "Kids Cereal", pctOfSoupBaskets: 14.9 },
    { pairedProduct: "Potato Chips", pctOfSoupBaskets: 14.4 },
    { pairedProduct: "Eggs", pctOfSoupBaskets: 13.4 },
    { pairedProduct: "Wheat Bread", pctOfSoupBaskets: 13.2 }
  ],
  topPairs: [
    { pair: "Hot Dog Buns + Premium Beef", lift: 14.6, supportPct: 0.217 },
    { pair: "Hot Dog Buns + Premium Meat", lift: 13.3, supportPct: 0.579 },
    { pair: "Frozen Patties + Hamburger Buns", lift: 10.8, supportPct: 0.343 },
    { pair: "Refrigerated Biscuits + Pork Rolls", lift: 10.2, supportPct: 0.312 },
    { pair: "Economy Meat + Hot Dog Buns", lift: 10.1, supportPct: 0.404 },
    { pair: "Hamburger Buns + Patties", lift: 8.6, supportPct: 0.258 },
    { pair: "Cream Cheese + Misc Meat", lift: 8.1, supportPct: 0.244 },
    { pair: "Lean Meat + Mexican Seasoning", lift: 8.1, supportPct: 0.31 }
  ]
};

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS pitch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    created_at TEXT NOT NULL,
    trigger_status TEXT NOT NULL,
    avg_temp REAL NOT NULL,
    wet_days INTEGER NOT NULL,
    pitch_text TEXT NOT NULL
  );
`);

const insertPitch = db.prepare(`
  INSERT INTO pitch_history (city, created_at, trigger_status, avg_temp, wet_days, pitch_text)
  VALUES (@city, @created_at, @trigger_status, @avg_temp, @wet_days, @pitch_text)
`);

const listPitches = db.prepare(`
  SELECT id, city, created_at, trigger_status, avg_temp, wet_days, pitch_text
  FROM pitch_history
  ORDER BY datetime(created_at) DESC, id DESC
  LIMIT 20
`);

const app = express();
app.use(express.json());

function readUnifiedSignal(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(UNIFIED_SIGNAL_PATH)) return null;
    const raw = fs.readFileSync(UNIFIED_SIGNAL_PATH, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getCityByName(name?: string): City {
  const normalized = (name ?? "Mississauga").trim().toLowerCase();
  return cities.find((city) => city.name.toLowerCase() === normalized) ?? cities[0];
}

function getWeatherEmoji(code: number): string {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([51, 53, 55].includes(code)) return "🌦️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  if ([1, 2].includes(code)) return "⛅";
  if (code === 3) return "☁️";
  return "☀️";
}

function evaluateTrigger(forecast: ForecastDay[]) {
  const window = forecast.slice(1, 4);
  const avgTemp = Number((window.reduce((sum, day) => sum + day.tempAvg, 0) / window.length).toFixed(1));
  const wetDays = window.filter((day) => wetCodes.has(day.weatherCode)).length;
  const windowDates = window.map((day) => day.date);
  return {
    triggered: avgTemp < WEATHER_THRESHOLD && wetDays > 0,
    avgTemp,
    wetDays,
    threshold: WEATHER_THRESHOLD,
    windowDates
  };
}

async function fetchWeather(city: City) {
  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    timezone: "America/Toronto",
    forecast_days: "7"
  });
  params.append("daily", "temperature_2m_max");
  params.append("daily", "temperature_2m_min");
  params.append("daily", "precipitation_sum");
  params.append("daily", "weathercode");

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      weathercode: number[];
    };
  };

  const forecast: ForecastDay[] = data.daily.time.map((date, index) => {
    const tempMax = data.daily.temperature_2m_max[index];
    const tempMin = data.daily.temperature_2m_min[index];
    const weatherCode = data.daily.weathercode[index];
    return {
      date,
      tempMax,
      tempMin,
      tempAvg: Number(((tempMax + tempMin) / 2).toFixed(1)),
      precipitationMm: data.daily.precipitation_sum[index],
      weatherCode,
      weatherLabel: wmo[weatherCode] ?? "Unknown",
      inTriggerWindow: false
    };
  });

  const trigger = evaluateTrigger(forecast);
  const windowSet = new Set(trigger.windowDates);
  const forecastWithWindow = forecast.map((day) => ({
    ...day,
    emoji: getWeatherEmoji(day.weatherCode),
    inTriggerWindow: windowSet.has(day.date)
  }));

  return { forecast: forecastWithWindow, trigger };
}

function buildPitchPrompt(city: string, weatherData: { forecast: ForecastDay[]; trigger: ReturnType<typeof evaluateTrigger> }) {
  const lines = weatherData.forecast.slice(0, 5).map((day) => {
    return `${day.date}: ${day.weatherLabel}, ${day.tempMin}C to ${day.tempMax}C, precip ${day.precipitationMm}mm`;
  });

  const unified = readUnifiedSignal();
  const basket = unified?.basket_analysis as Record<string, unknown> | undefined;
  const soup = (basket?.soup_companions as Array<{ product?: string; pct_of_soup_baskets?: number }> | undefined) ?? [];
  const soupLines = soup
    .slice(0, 6)
    .map((s) => `- ${s.product ?? "?"}: ${s.pct_of_soup_baskets ?? "?"}% of soup baskets`)
    .join("\n");

  const cross = (basket?.top_cross_dept_pairs as Array<{ pair?: string; lift?: number }> | undefined) ?? [];
  const crossLines = cross
    .slice(0, 4)
    .map((c) => `- ${c.pair ?? "?"}: ${c.lift ?? "?"}x lift`)
    .join("\n");

  const promo = unified?.promo_attribution as Record<string, unknown> | undefined;
  const promoCats = (promo?.best_tactic_by_category as unknown[])?.length ?? 0;
  const bestTier = (promo?.best_store_tier_for_activation as string) ?? "n/a";

  const el = unified?.price_elasticity as Record<string, unknown> | undefined;
  const elasticN = ((el?.most_elastic_categories as unknown[]) ?? []).length;

  const demo = unified?.demographics as Record<string, unknown> | undefined;
  const topSeg = demo?.top_soup_buyer_segment as Record<string, unknown> | undefined;
  const demoLine = topSeg
    ? `Top soup-heavy segment: ${topSeg.age_group ?? "?"} / ${topSeg.income_group ?? "?"} (soup penetration ${topSeg.soup_penetration_pct ?? "?"}%).`
    : "Demographic soup segment: not available in this build (rerun segmentation when CJ tables are wired).";

  const datasets = ((unified?.meta as Record<string, unknown> | undefined)?.datasets_used as string[] | undefined) ?? [];

  return `
You are a senior retail analytics consultant preparing a proactive CPG pitch for a major Canadian grocery retailer.

AUDIENCE + FORMAT
-------------------
Write for a busy brand manager (90 seconds to read). Short paragraphs only (no bullet lists in the final pitch body),
but you may use bullets while thinking. Max ~320 words.

RETAIL CONTEXT
--------------
City: ${city}
3-day average temperature: ${weatherData.trigger.avgTemp}C
Wet days in trigger window: ${weatherData.trigger.wetDays}
Trigger threshold: ${weatherData.trigger.threshold}C
Trigger fired: ${weatherData.trigger.triggered ? "Yes" : "No"}

Forecast summary:
${lines.join("\n")}

DATA SIGNALS (use only what is supported by the facts below)
-----------------------------------------------------------
Datasets referenced in unified signal bundle:
${datasets.length ? datasets.map((d) => `- ${d}`).join("\n") : "- (unified signal file missing — keep claims conservative)"}

Soup basket companions (co-purchase penetration among soup baskets):
${soupLines || "- (not available)"}

Cross-department pair examples (lift):
${crossLines || "- (not available)"}

Promo attribution summary (BATF / Carbo where loaded):
- Categories with inferred best tactic: ${promoCats}
- Best store tier for activation: ${bestTier}

Price elasticity summary:
- Elastic categories available: ${elasticN}

Demographics summary:
- ${demoLine}

CORE STORY (must appear clearly)
--------------------------------
Explain why a soup + fluid milk bundle / adjacency / digital coupon stack is credible this week, anchored on cold/wet demand
and the strongest soup companion penetration (fluid milk).

DELIVERABLES (must include all)
---------------------------------
1) Weather-led hook (1 sentence)
2) Quantified basket insight (soup + milk + 1–2 supporting companions)
3) Retail activation plan (choose one: end-cap, aisle interrupt, app offer, loyalty coupon stack) with timing THIS WEEK
4) Measurement plan (what KPIs you will track for 14 days)
5) Risks + mitigations (stock-out, margin, category conflict)
6) Clear CTA (what decision you need now)

Tone: confident, precise, no hype without numbers.
`.trim();
}

app.get("/api/cities", (_req, res) => {
  res.json(cities);
});

app.get("/api/weather", async (req, res) => {
  try {
    const city = getCityByName(typeof req.query.city === "string" ? req.query.city : undefined);
    const weather = await fetchWeather(city);
    res.json({ city, ...weather });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/basket-data", (_req, res) => {
  res.json(basketData);
});

app.get("/api/signals/unified", (_req, res) => {
  const unified = readUnifiedSignal();
  if (!unified) {
    res.status(404).json({ error: "unified_signal.json not found", path: UNIFIED_SIGNAL_PATH });
    return;
  }
  res.json(unified);
});

app.get("/api/signals/promo", (_req, res) => {
  const unified = readUnifiedSignal();
  const promo = (unified?.promo_attribution as Record<string, unknown>) ?? {};
  res.json(promo);
});

app.get("/api/signals/price-elasticity", (_req, res) => {
  const unified = readUnifiedSignal();
  const elasticity = (unified?.price_elasticity as Record<string, unknown>) ?? {};
  res.json(elasticity);
});

app.get("/api/signals/demographics", (_req, res) => {
  const unified = readUnifiedSignal();
  const demographics = (unified?.demographics as Record<string, unknown>) ?? {};
  res.json(demographics);
});

app.get("/api/pitch-history", (_req, res) => {
  const rows = listPitches.all();
  res.json(rows);
});

app.post("/api/generate-pitch", async (req, res) => {
  try {
    const { city, weatherData } = req.body as {
      city?: string;
      weatherData?: { forecast: ForecastDay[]; trigger: ReturnType<typeof evaluateTrigger> };
    };

    if (!city || !weatherData) {
      res.status(400).json({ error: "city and weatherData are required" });
      return;
    }

    const prompt = buildPitchPrompt(city, weatherData);

    if (!process.env.GROQ_API_KEY) {
      res.status(503).json({ error: "GROQ_API_KEY is not set", prompt });
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500
    });

    const pitchText = completion.choices[0]?.message?.content?.trim() ?? "No pitch generated.";
    insertPitch.run({
      city,
      created_at: new Date().toISOString(),
      trigger_status: weatherData.trigger.triggered ? "Triggered" : "Monitoring",
      avg_temp: weatherData.trigger.avgTemp,
      wet_days: weatherData.trigger.wetDays,
      pitch_text: pitchText
    });

    res.json({ pitch: pitchText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pitch generation error";
    res.status(500).json({ error: message });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`CPG dashboard API server listening on http://localhost:${PORT}`);
});

server.keepAliveTimeout = 0;
server.on("error", (err) => console.error("Server error:", err));
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled:", err));
process.on("exit", (code) => console.log("Process exiting with code:", code));
process.on("beforeExit", (code) => console.log("Before exit, code:", code));
