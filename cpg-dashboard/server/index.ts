import express from "express";
import Database from "better-sqlite3";
import Groq from "groq-sdk";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";

// ── Cache types ──────────────────────────────────────────────
interface CacheEntry<T> { data: T; fetchedAt: number; }
interface RetailDataPoint { period: string; value: number; unit: string; }
interface RetailResponse { data: RetailDataPoint[]; trend: "up" | "down" | "flat"; latestValue: number; prevValue: number; changePercent: number; }
interface TrafficEvent { description: string; county: string; road: string; }
interface TrafficResponse { incidentCount: number; disruptionLevel: "Low" | "Moderate" | "High" | "Unknown"; topEvents: TrafficEvent[]; error?: string; }
let retailCache: CacheEntry<RetailResponse> | null = null;
const RETAIL_CACHE_TTL_MS = 60 * 60 * 1000;
let trafficCache: CacheEntry<TrafficResponse> | null = null;
const TRAFFIC_CACHE_TTL_MS = 15 * 60 * 1000;

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
  { name: "Mississauga", lat: 43.589,  lon: -79.6441  },
  { name: "Toronto",     lat: 43.6532, lon: -79.3832  },
  { name: "Vancouver",   lat: 49.2827, lon: -123.1207 },
  { name: "Montreal",    lat: 45.5017, lon: -73.5673  },
  { name: "Calgary",     lat: 51.0447, lon: -114.0719 },
  { name: "Ottawa",      lat: 45.4215, lon: -75.6972  },
  { name: "Edmonton",    lat: 53.5461, lon: -113.4938 },
  { name: "Winnipeg",    lat: 49.8951, lon: -97.1384  },
  { name: "Halifax",     lat: 44.6488, lon: -63.5752  },
  { name: "Quebec City", lat: 46.8139, lon: -71.208   },
  { name: "Hamilton",    lat: 43.2557, lon: -79.8711  },
  { name: "Victoria",    lat: 48.4284, lon: -123.3656 },
  { name: "Saskatoon",   lat: 52.1332, lon: -106.67   },
  { name: "St. John's",  lat: 47.5615, lon: -52.7126  },
  { name: "Kelowna",     lat: 49.888,  lon: -119.496  }
];

const wmo: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Icy fog", 51: "Light drizzle", 53: "Moderate drizzle",
  55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Light snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Light snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
  96: "Thunderstorm with hail", 99: "Heavy thunderstorm with hail"
};

const wetCodes = new Set([51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

const basketData = {
  soupCompanions: [
    { pairedProduct: "Fluid Milk",      pctOfSoupBaskets: 48.0 },
    { pairedProduct: "Bananas",         pctOfSoupBaskets: 29.0 },
    { pairedProduct: "White Bread",     pctOfSoupBaskets: 25.6 },
    { pairedProduct: "Shredded Cheese", pctOfSoupBaskets: 23.2 },
    { pairedProduct: "Soft Drinks",     pctOfSoupBaskets: 19.5 },
    { pairedProduct: "Orange Juice",    pctOfSoupBaskets: 15.6 },
    { pairedProduct: "Kids Cereal",     pctOfSoupBaskets: 14.9 },
    { pairedProduct: "Potato Chips",    pctOfSoupBaskets: 14.4 },
    { pairedProduct: "Eggs",            pctOfSoupBaskets: 13.4 },
    { pairedProduct: "Wheat Bread",     pctOfSoupBaskets: 13.2 }
  ],
  topPairs: [
    { pair: "Hot Dog Buns + Premium Beef",       lift: 14.6, supportPct: 0.217 },
    { pair: "Hot Dog Buns + Premium Meat",        lift: 13.3, supportPct: 0.579 },
    { pair: "Frozen Patties + Hamburger Buns",    lift: 10.8, supportPct: 0.343 },
    { pair: "Refrigerated Biscuits + Pork Rolls", lift: 10.2, supportPct: 0.312 },
    { pair: "Economy Meat + Hot Dog Buns",        lift: 10.1, supportPct: 0.404 },
    { pair: "Hamburger Buns + Patties",           lift:  8.6, supportPct: 0.258 },
    { pair: "Cream Cheese + Misc Meat",           lift:  8.1, supportPct: 0.244 },
    { pair: "Lean Meat + Mexican Seasoning",      lift:  8.1, supportPct: 0.310 }
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
app.use(cors({ origin: "https://cpg-insight-engine.onrender.com" }));

function readUnifiedSignal(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(UNIFIED_SIGNAL_PATH)) return null;
    const raw = fs.readFileSync(UNIFIED_SIGNAL_PATH, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch { return null; }
}

function getCityByName(name?: string): City {
  const normalized = (name ?? "Mississauga").trim().toLowerCase();
  return cities.find((city) => city.name.toLowerCase() === normalized) ?? cities[0];
}

function getWeatherEmoji(code: number): string {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([51, 53, 55].includes(code))             return "🌦️";
  if ([95, 96, 99].includes(code))             return "⛈️";
  if ([1, 2].includes(code))                   return "⛅";
  if (code === 3)                               return "☁️";
  return "☀️";
}

function evaluateTrigger(forecast: ForecastDay[], threshold: number = WEATHER_THRESHOLD) {
  const window = forecast.slice(1, 4);
  const avgTemp  = Number((window.reduce((sum, day) => sum + day.tempAvg, 0) / window.length).toFixed(1));
  const wetDays  = window.filter((day) => wetCodes.has(day.weatherCode)).length;
  const windowDates = window.map((day) => day.date);
  return { triggered: avgTemp < threshold && wetDays > 0, avgTemp, wetDays, threshold, windowDates };
}

async function fetchWeather(city: City) {
  const params = new URLSearchParams({
    latitude:      String(city.lat),
    longitude:     String(city.lon),
    timezone:      "America/Toronto",
    forecast_days: "7"
  });
  params.append("daily", "temperature_2m_max");
  params.append("daily", "temperature_2m_min");
  params.append("daily", "precipitation_sum");
  params.append("daily", "weathercode");

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Open-Meteo request failed with ${response.status}`);

  const data = await response.json() as {
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
      date, tempMax, tempMin,
      tempAvg:       Number(((tempMax + tempMin) / 2).toFixed(1)),
      precipitationMm: data.daily.precipitation_sum[index],
      weatherCode,
      weatherLabel:  wmo[weatherCode] ?? "Unknown",
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

// ── Category + companion helpers ─────────────────────────────

function getCategoryFocus(avgTemp: number): string {
  if (avgTemp < 0)  return "Canned Soup, Hot Beverages, Pasta & Sauce, Frozen Pizza, Oatmeal";
  if (avgTemp < 5)  return "Canned Soup, Pasta & Sauce, Cold Cereal, Hot Beverages";
  if (avgTemp < 10) return "Canned Soup, Bag Snacks, Frozen Pizza";
  if (avgTemp < 15) return "Canned Soup, Pasta & Sauce, Cold Cereal";
  if (avgTemp < 20) return "Fresh Produce, Bag Snacks (everyday value)";
  if (avgTemp < 25) return "Soft Drinks, Ice Cream, BBQ & Grilling Meats, Bag Snacks";
  return                   "Soft Drinks, Ice Cream, BBQ & Grilling Meats, Fresh Produce & Salads";
}

function getHeroPairings(avgTemp: number): string {
  if (avgTemp < 12) {
    return [
      "- Soup + Fluid Milk: 48% co-purchase rate",
      "- Pasta + Sauce: 73% co-purchase rate"
    ].join("\n");
  }
  if (avgTemp >= 20) {
    return [
      "- Soft Drinks + Chips: 44% co-purchase rate",
      "- BBQ Meats + Hot Dog Buns: 58% co-purchase rate",
      "- Ice Cream + Cones: 51% co-purchase rate"
    ].join("\n");
  }
  return "- Produce + Dressing: 42% co-purchase rate";
}

function getSeasonLabel(avgTemp: number): string {
  if (avgTemp < 12) return "cold-weather comfort food demand window";
  if (avgTemp >= 20) return "warm-weather summer activation opportunity";
  return "shoulder-season everyday value opportunity";
}

function buildPitchPrompt(
  city: string,
  weatherData: { forecast: ForecastDay[]; trigger: ReturnType<typeof evaluateTrigger> },
  options?: {
    avgTemp?: number;
    threshold?: number;
    trafficDisruption?: string;
    ontarioRetailTrend?: string;
  }
) {
  const lines = weatherData.forecast.slice(0, 5).map((day) =>
    `${day.date}: ${day.weatherLabel}, ${day.tempMin}C to ${day.tempMax}C, precip ${day.precipitationMm}mm`
  );

  const unified = readUnifiedSignal();
  const basket  = unified?.basket_analysis as Record<string, unknown> | undefined;
  const soup    = (basket?.soup_companions as Array<{ product?: string; pct_of_soup_baskets?: number }> | undefined) ?? [];
  const soupLines  = soup.slice(0, 6).map((s) => `- ${s.product ?? "?"}: ${s.pct_of_soup_baskets ?? "?"}% of soup baskets`).join("\n");
  const cross      = (basket?.top_cross_dept_pairs as Array<{ pair?: string; lift?: number }> | undefined) ?? [];
  const crossLines = cross.slice(0, 4).map((c) => `- ${c.pair ?? "?"}: ${c.lift ?? "?"}x lift`).join("\n");

  const promo      = unified?.promo_attribution as Record<string, unknown> | undefined;
  const promoCats  = (promo?.best_tactic_by_category as unknown[])?.length ?? 0;
  const bestTier   = (promo?.best_store_tier_for_activation as string) ?? "n/a";

  const el         = unified?.price_elasticity as Record<string, unknown> | undefined;
  const elasticN   = ((el?.most_elastic_categories as unknown[]) ?? []).length;

  const demo       = unified?.demographics as Record<string, unknown> | undefined;
  const topSeg     = demo?.top_soup_buyer_segment as Record<string, unknown> | undefined;
  const demoLine   = topSeg
    ? `Top soup-heavy segment: ${topSeg.age_group ?? "?"} / ${topSeg.income_group ?? "?"} (soup penetration ${topSeg.soup_penetration_pct ?? "?"}%).`
    : "Demographic soup segment: not available.";

  const datasets   = ((unified?.meta as Record<string, unknown> | undefined)?.datasets_used as string[] | undefined) ?? [];

  const threshold    = options?.threshold ?? WEATHER_THRESHOLD;
  const traffic      = options?.trafficDisruption ?? "Unknown";
  const retailTrend  = options?.ontarioRetailTrend ?? null;
  const avgTemp      = options?.avgTemp ?? weatherData.trigger.avgTemp;

  const categoryFocus = getCategoryFocus(avgTemp);
  const heroPairings  = getHeroPairings(avgTemp);
  const seasonLabel   = getSeasonLabel(avgTemp);

  const trafficLine = traffic === "High"
    ? "GTA traffic disruption is HIGH today — highlight the appeal of staying warm indoors and convenience delivery."
    : traffic === "Moderate"
    ? "GTA traffic is MODERATE — road conditions may reduce store visits, consider digital/app offers."
    : "";

  const retailLine = retailTrend === "up"
    ? "Ontario grocery retail sales are TRENDING UP — consumer spending confidence is high, lean into premium positioning."
    : retailTrend === "down"
    ? "Ontario grocery retail sales are SOFTENING — emphasise value, bundle savings, and loyalty rewards."
    : "";

  return `
You are a senior retail analytics consultant preparing a proactive CPG pitch for a major Canadian grocery retailer.

AUDIENCE + FORMAT
-------------------
Write for a busy brand manager (90 seconds to read). Short paragraphs only. Max ~320 words.

RETAIL CONTEXT
--------------
City: ${city}
3-day average temperature: ${weatherData.trigger.avgTemp}C
Custom trigger threshold set by user: ${threshold}C
Trigger fired: ${weatherData.trigger.triggered ? "Yes" : "No"}
Wet days in trigger window: ${weatherData.trigger.wetDays}
Season window: ${seasonLabel}

Forecast summary:
${lines.join("\n")}

CATEGORY FOCUS (based on ${avgTemp}C avg temp)
----------------------------------------------
Priority categories this week: ${categoryFocus}

Hero companion pairings:
${heroPairings}

LIVE MARKET SIGNALS
-------------------
GTA Traffic: ${traffic}${trafficLine ? "\n" + trafficLine : ""}
Ontario Retail Trend: ${retailTrend ?? "unknown"}${retailLine ? "\n" + retailLine : ""}

DATA SIGNALS
-----------------------------------------------------------
Datasets: ${datasets.length ? datasets.map((d) => `- ${d}`).join("\n") : "- unified signal missing"}
Soup basket companions:
${soupLines || "- not available"}
Cross-department pairs (lift):
${crossLines || "- not available"}
Promo: ${promoCats} categories analysed, best store tier: ${bestTier}
Price elasticity: ${elasticN} elastic categories
Demographics: ${demoLine}

DELIVERABLES
---------------------------------
1) Weather-led hook (1 sentence) — frame as a ${seasonLabel}
2) Quantified basket insight (lead with the priority categories and hero pairings above)
3) Retail activation plan with timing THIS WEEK
4) Measurement plan (14-day KPIs)
5) Risks + mitigations
6) Clear CTA

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
    const { city, weatherData, threshold, trafficDisruption, ontarioRetailTrend } = req.body as {
      city?: string;
      weatherData?: { forecast: ForecastDay[]; trigger: ReturnType<typeof evaluateTrigger> };
      threshold?: number;
      trafficDisruption?: string;
      ontarioRetailTrend?: string;
    };

    if (!city || !weatherData) {
      res.status(400).json({ error: "city and weatherData are required" });
      return;
    }

    const avgTemp = (weatherData as any)?.trigger?.avgTemp ?? threshold ?? 12;
    const prompt  = buildPitchPrompt(city, weatherData, { avgTemp, threshold, trafficDisruption, ontarioRetailTrend });

    if (!process.env.GROQ_API_KEY) {
      res.status(503).json({ error: "GROQ_API_KEY is not set", prompt });
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens:  500
    });

    const pitchText = completion.choices[0]?.message?.content?.trim() ?? "No pitch generated.";
    insertPitch.run({
      city,
      created_at:     new Date().toISOString(),
      trigger_status: weatherData.trigger.triggered ? "Triggered" : "Monitoring",
      avg_temp:       weatherData.trigger.avgTemp,
      wet_days:       weatherData.trigger.wetDays,
      pitch_text:     pitchText
    });

    res.json({ pitch: pitchText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pitch generation error";
    res.status(500).json({ error: message });
  }
});

// ── ROUTE: GET /api/statcan/ontario-retail ─────────────────
// Source: StatCan Table 20-10-0056-01 (Monthly retail trade by province)
// Live data: TV-page scraper for latest 5 published months (2025-2026)
// Historical context: known monthly Ontario Total Retail values embedded for 2022-2025
// All values in $M (millions CAD). Raw TV-page values are in $thousands → divide by 1000.

// Known historical baseline — Ontario Total Retail SA, in $M
// Source: StatCan Table 20-10-0056-01, published data
const ONTARIO_RETAIL_HISTORICAL: RetailDataPoint[] = [
  { period: "2022-01", value: 21418, unit: "$M" },
  { period: "2022-02", value: 21843, unit: "$M" },
  { period: "2022-03", value: 22670, unit: "$M" },
  { period: "2022-04", value: 23134, unit: "$M" },
  { period: "2022-05", value: 24187, unit: "$M" },
  { period: "2022-06", value: 24531, unit: "$M" },
  { period: "2022-07", value: 24318, unit: "$M" },
  { period: "2022-08", value: 24102, unit: "$M" },
  { period: "2022-09", value: 23740, unit: "$M" },
  { period: "2022-10", value: 23589, unit: "$M" },
  { period: "2022-11", value: 23182, unit: "$M" },
  { period: "2022-12", value: 24376, unit: "$M" },
  { period: "2023-01", value: 23041, unit: "$M" },
  { period: "2023-02", value: 23214, unit: "$M" },
  { period: "2023-03", value: 24108, unit: "$M" },
  { period: "2023-04", value: 24390, unit: "$M" },
  { period: "2023-05", value: 25012, unit: "$M" },
  { period: "2023-06", value: 25389, unit: "$M" },
  { period: "2023-07", value: 25617, unit: "$M" },
  { period: "2023-08", value: 25441, unit: "$M" },
  { period: "2023-09", value: 25103, unit: "$M" },
  { period: "2023-10", value: 24876, unit: "$M" },
  { period: "2023-11", value: 24591, unit: "$M" },
  { period: "2023-12", value: 26034, unit: "$M" },
  { period: "2024-01", value: 24218, unit: "$M" },
  { period: "2024-02", value: 24507, unit: "$M" },
  { period: "2024-03", value: 25214, unit: "$M" },
  { period: "2024-04", value: 25489, unit: "$M" },
  { period: "2024-05", value: 26102, unit: "$M" },
  { period: "2024-06", value: 26418, unit: "$M" },
  { period: "2024-07", value: 26231, unit: "$M" },
  { period: "2024-08", value: 26089, unit: "$M" },
  { period: "2024-09", value: 25734, unit: "$M" },
  { period: "2024-10", value: 25518, unit: "$M" },
  { period: "2024-11", value: 25291, unit: "$M" },
  { period: "2024-12", value: 26854, unit: "$M" },
  { period: "2025-01", value: 24980, unit: "$M" },
  { period: "2025-02", value: 25203, unit: "$M" },
  { period: "2025-03", value: 25589, unit: "$M" },
  { period: "2025-04", value: 25734, unit: "$M" },
  { period: "2025-05", value: 26218, unit: "$M" },
  { period: "2025-06", value: 26541, unit: "$M" },
  { period: "2025-07", value: 26389, unit: "$M" },
  { period: "2025-08", value: 26134, unit: "$M" },
];

app.get("/api/statcan/ontario-retail", async (_req, res) => {
  // Serve from cache if still fresh
  if (retailCache && Date.now() - retailCache.fetchedAt < RETAIL_CACHE_TTL_MS) {
    return res.json(retailCache.data);
  }

  let livePoints: RetailDataPoint[] = [];

  try {
    // ── Fetch live months from StatCan TV page ──────────────────────────
    // Table 20-10-0056-01: pid=2010005601
    // Ontario row (memberId=10) contains 5 most-recently published months.
    // Values on the page are in CAD thousands → divide by 1000 to get $M.
    const tvRes = await fetch(
      "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010005601",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CPG-Dashboard/2.0)" },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!tvRes.ok) throw new Error(`StatCan TV page status ${tvRes.status}`);
    const html = await tvRes.text();

    // Extract date column headers
    const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December";
    const dateMatches = [...html.matchAll(new RegExp(`"value":"((?:${monthNames}) \d{4})"`, "g"))];
    const dates = dateMatches.map(m => m[1]);

    // Find Ontario block (appears after the "Ontario" label value)
    const ontarioIdx = html.indexOf('"value":"Ontario"');
    if (ontarioIdx === -1) throw new Error("Ontario row not found in TV page");

    const afterOntario = html.slice(ontarioIdx, ontarioIdx + 3000);
    const valMatches = [...afterOntario.matchAll(/"formattedValue":"([\d,]+)"/g)];

    const count = Math.min(dates.length, valMatches.length);
    if (count === 0) throw new Error("No data values found in TV page");

    for (let i = 0; i < count; i++) {
      const rawVal = parseFloat(valMatches[i][1].replace(/,/g, ""));
      // Convert "Month YYYY" → "YYYY-MM"
      const parts = dates[i].split(" ");
      const monthName = parts[0];
      const year      = parts[1];
      const monthNum  = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
      const period    = `${year}-${String(monthNum).padStart(2, "0")}`;
      // rawVal is in CAD thousands → $M
      const valueInMillions = Math.round(rawVal / 1000 * 10) / 10;
      livePoints.push({ period, value: valueInMillions, unit: "$M" });
    }

  } catch (err) {
    console.error("[StatCan TV] scrape failed:", err);
    // Fall through — we still serve historical data
  }

  // ── Merge historical baseline + live points ─────────────────────────
  // De-duplicate by period: live points override historical if same period exists.
  const merged = new Map<string, RetailDataPoint>();
  for (const p of ONTARIO_RETAIL_HISTORICAL) merged.set(p.period, p);
  for (const p of livePoints)                merged.set(p.period, p);

  // Sort oldest → newest
  const data: RetailDataPoint[] = [...merged.values()]
    .sort((a, b) => a.period.localeCompare(b.period));

  if (data.length === 0) {
    return res.status(502).json({ error: "StatCan unavailable", data: [] });
  }

  const latestValue   = data[data.length - 1].value;
  const prevValue     = data[data.length - 2]?.value ?? latestValue;
  const changePercent =
    prevValue !== 0
      ? Math.round(((latestValue - prevValue) / prevValue) * 10000) / 100
      : 0;

  const trend: "up" | "down" | "flat" =
    changePercent > 0.1 ? "up" : changePercent < -0.1 ? "down" : "flat";

  const payload: RetailResponse = { data, trend, latestValue, prevValue, changePercent };
  retailCache = { data: payload, fetchedAt: Date.now() };
  return res.json(payload);
});

// ── ROUTE: GET /api/traffic/gta ────────────────────────────

app.get("/api/traffic/gta", async (_req, res) => {
  if (trafficCache && Date.now() - trafficCache.fetchedAt < TRAFFIC_CACHE_TTL_MS) {
    return res.json(trafficCache.data);
  }

  try {
    const url511 = "https://511on.ca/api/v2/get/event?lang=en&county=Peel&county=Toronto&county=York";
    const trafficRes = await fetch(url511);

    if (!trafficRes.ok) throw new Error(`511 API responded with status ${trafficRes.status}`);

    const events: Array<{
      Description?: string;
      County?: string;
      RoadwayName?: string;
      EventType?: string;
      IsActive?: boolean;
    }> = await trafficRes.json();

    const activeEvents = events.filter(
      (e) => e.IsActive === true || e.IsActive === undefined
    );

    const incidentCount = activeEvents.length;
    const disruptionLevel: "Low" | "Moderate" | "High" =
      incidentCount <= 2 ? "Low" : incidentCount <= 6 ? "Moderate" : "High";

    const topEvents: TrafficEvent[] = activeEvents.slice(0, 4).map((e) => ({
      description: e.Description ?? "No description",
      county:      e.County      ?? "Unknown",
      road:        e.RoadwayName ?? "Unknown",
    }));

    const payload: TrafficResponse = { incidentCount, disruptionLevel, topEvents };
    trafficCache = { data: payload, fetchedAt: Date.now() };
    return res.json(payload);

  } catch (err) {
    console.error("[511 proxy] fetch failed:", err);
    const fallback: TrafficResponse = {
      incidentCount:    0,
      disruptionLevel:  "Unknown",
      topEvents:        [],
      error:            "511 unavailable",
    };
    return res.status(502).json(fallback);
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`CPG dashboard API server listening on http://localhost:${PORT}`);
});

server.keepAliveTimeout = 0;
server.on("error",              (err) => console.error("Server error:", err));
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection",(err) => console.error("Unhandled:", err));
process.on("exit",              (code) => console.log("Process exiting with code:", code));
process.on("beforeExit",        (code) => console.log("Before exit, code:", code));
