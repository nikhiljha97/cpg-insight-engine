import express from "express";
import Database from "better-sqlite3";
import Groq from "groq-sdk";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import { isDemandCategory, type DemandCategory } from "../src/constants/demandCategories.js";

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

const PORT = Number(process.env.PORT) || 4000;
const WEATHER_THRESHOLD = 12;
const DB_PATH = "cpg.db";
const UNIFIED_SIGNAL_PATH = path.join(process.cwd(), "..", "output", "unified_signal.json");
const KAGGLE_SOURCES_PATH = path.join(process.cwd(), "server", "kaggle_sources.json");

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
const corsOrigins = [
  "https://cpg-insight-engine.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [])
];
app.use(cors({ origin: corsOrigins }));

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

type CalendarSeason = "winter" | "spring" | "summer" | "fall";
type BasketScenario = "cold_wet" | "cold_dry" | "mild_wet" | "warm_dry" | "warm_wet";
type BasketAnchorKey = "soup" | "soft_drinks" | "bbq" | "produce";

function calendarSeasonFromIsoDate(dateStr: string): CalendarSeason {
  const d = new Date(`${dateStr}T12:00:00`);
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

function deriveBasketScenario(trigger: ReturnType<typeof evaluateTrigger>): BasketScenario {
  const cold = trigger.avgTemp < trigger.threshold;
  const wet = trigger.wetDays > 0;
  if (cold && wet) return "cold_wet";
  if (cold && !wet) return "cold_dry";
  if (!cold && wet) return trigger.avgTemp >= 20 ? "warm_wet" : "mild_wet";
  return "warm_dry";
}

function basketScenarioLabel(scenario: BasketScenario): string {
  switch (scenario) {
    case "cold_wet":
      return "Cold & wet — comfort basket pull";
    case "cold_dry":
      return "Cold & dry — pantry & value stocking";
    case "mild_wet":
      return "Mild & wet — planned trip, fuller basket";
    case "warm_dry":
      return "Warm & dry — impulse, beverage, outdoor";
    case "warm_wet":
      return "Warm & wet — convenience + treats";
    default:
      return scenario;
  }
}

function pickBasketAnchor(
  scenario: BasketScenario,
  season: CalendarSeason
): { key: BasketAnchorKey; label: string; rationale: string } {
  switch (scenario) {
    case "cold_wet":
      return {
        key: "soup",
        label: "Soup-led comfort basket",
        rationale:
          "Cold wet windows lift hot meals and one-pot solutions; soup is the clearest anchor in the Dunnhumby-style signal."
      };
    case "cold_dry":
      return {
        key: "soup",
        label: "Soup & pantry fill",
        rationale: "Dry cold days still pull comfort grocery; soup plus staples remains the strongest co-purchase story."
      };
    case "mild_wet":
      return {
        key: "produce",
        label: "Produce-led basket",
        rationale:
          "Shoulder wet trips skew toward meal assembly; produce plus dressings and sides is a practical hero outside pure soup."
      };
    case "warm_dry":
      if (season === "summer") {
        return {
          key: "soft_drinks",
          label: "Beverage & snack basket",
          rationale: "Warm dry summer days spike cold beverages, ice cream, and bag snacks for immediate consumption."
        };
      }
      if (season === "spring") {
        return {
          key: "bbq",
          label: "Grilling & outdoor meal",
          rationale: "Warm dry spring windows favour buns, patties, and premium meat pairings from lift data."
        };
      }
      return {
        key: "soft_drinks",
        label: "Beverage-led basket",
        rationale: "Warm dry conditions still favour cold categories and impulse treats in fall and winter shoulder days."
      };
    case "warm_wet":
    default:
      return {
        key: "soft_drinks",
        label: "Treats & convenience",
        rationale: "Warm stormy days nudge toward easy meals, snacks, and beverages for at-home or quick trips."
      };
  }
}

function readSoupCompanions(
  unified: Record<string, unknown> | null
): Array<{ product: string; pct: number }> {
  const basket = unified?.basket_analysis as Record<string, unknown> | undefined;
  const rows =
    (basket?.soup_companions as Array<{ product?: string; pct_of_soup_baskets?: number }> | undefined) ?? [];
  return rows
    .map((r) => ({ product: String(r.product ?? ""), pct: Number(r.pct_of_soup_baskets ?? 0) }))
    .filter((r) => r.product);
}

function companionsForBasketAnchor(
  unified: Record<string, unknown> | null,
  key: BasketAnchorKey
): Array<{ product: string; pct: number }> {
  const soup = readSoupCompanions(unified);
  if (key === "soup" && soup.length) return soup;

  if (key === "soft_drinks") {
    return [
      { product: "Bag Snacks", pct: 44 },
      { product: "Frozen Pizza", pct: 31 },
      { product: "Ice Cream", pct: 28 },
      { product: "Bottled Water", pct: 26 },
      { product: "Chocolate Candy", pct: 22 },
      { product: "Cookies", pct: 19 },
      { product: "Crackers", pct: 17 },
      { product: "Juice (shelf-stable)", pct: 16 }
    ];
  }
  if (key === "bbq") {
    return [
      { product: "Hot Dog Buns", pct: 58 },
      { product: "Premium Beef", pct: 42 },
      { product: "Frozen Patties", pct: 39 },
      { product: "Condiments (ketchup/mustard)", pct: 34 },
      { product: "Bag Snacks", pct: 33 },
      { product: "Soft Drinks", pct: 31 },
      { product: "Shredded Cheese", pct: 27 },
      { product: "Paper Plates", pct: 18 }
    ];
  }
  return [
    { product: "Bagged Salad", pct: 38 },
    { product: "Dressing", pct: 35 },
    { product: "Tomatoes", pct: 29 },
    { product: "Bananas", pct: 27 },
    { product: "Avocados", pct: 22 },
    { product: "Citrus", pct: 20 },
    { product: "Herbs", pct: 15 },
    { product: "Croutons", pct: 12 }
  ];
}

function crossPairsForBasketAnchor(
  unified: Record<string, unknown> | null,
  key: BasketAnchorKey
): Array<{ pair: string; lift: string; support: string }> {
  const basket = unified?.basket_analysis as Record<string, unknown> | undefined;
  const rows =
    (basket?.top_cross_dept_pairs as Array<{ pair?: string; lift?: number }> | undefined) ?? [];
  const toRow = (p: { pair?: string; lift?: number }) => ({
    pair: String(p.pair ?? ""),
    lift: `${Number(p.lift ?? 0)}x`,
    support: "—"
  });
  const hay = (s: string) => s.toLowerCase();
  const filtered = rows.filter((r) => {
    const p = hay(String(r.pair ?? ""));
    if (key === "bbq") return /hot dog|bun|patty|hamburger|beef|meat|biscuit|pork/.test(p);
    if (key === "soft_drinks") return /chip|snack|frozen|ice|pizza|cone|cookie|candy/.test(p);
    if (key === "produce") return /biscuit|pork|seasoning|mexican|cream|lean/.test(p);
    return true;
  });
  const pick = (filtered.length ? filtered : rows).slice(0, 8);
  return pick.map(toRow).filter((r) => r.pair);
}

/** Map dashboard demand category to the internal anchor key used for pair heuristics. */
function mapDemandCategoryToAnchorKey(category: DemandCategory): BasketAnchorKey {
  switch (category) {
    case "Canned Soup":
      return "soup";
    case "Hot Beverages":
    case "Soft Drinks":
    case "Ice Cream":
    case "Bag Snacks":
      return "soft_drinks";
    case "BBQ Meats":
    case "Frozen Pizza":
      return "bbq";
    case "Pasta & Sauce":
    case "Cold Cereal":
      return "produce";
    default:
      return "soup";
  }
}

const STATIC_DEMAND_COMPANIONS: Record<DemandCategory, Array<{ product: string; pct: number }>> = {
  "Canned Soup": [],
  "Hot Beverages": [
    { product: "Coffee / tea pods", pct: 44 },
    { product: "Fluid Milk", pct: 36 },
    { product: "Sugar & sweeteners", pct: 28 },
    { product: "Creamers", pct: 26 },
    { product: "Mugs & disposables", pct: 18 },
    { product: "Breakfast bars", pct: 17 },
    { product: "Bottled Water", pct: 15 },
    { product: "Cookies", pct: 14 },
  ],
  "Pasta & Sauce": [
    { product: "Shredded Cheese", pct: 52 },
    { product: "Ground Beef", pct: 39 },
    { product: "Garlic bread", pct: 33 },
    { product: "Parmesan / hard cheese", pct: 31 },
    { product: "Bagged Salad", pct: 27 },
    { product: "Frozen vegetables", pct: 24 },
    { product: "Italian dressing", pct: 21 },
    { product: "Red wine (adjacent)", pct: 12 },
  ],
  "Frozen Pizza": [
    { product: "Bag Snacks", pct: 46 },
    { product: "Soft Drinks", pct: 38 },
    { product: "Ice Cream", pct: 34 },
    { product: "Dipping sauces", pct: 29 },
    { product: "Frozen appetizers", pct: 25 },
    { product: "Paper plates", pct: 22 },
    { product: "Juice (shelf-stable)", pct: 18 },
    { product: "Chocolate Candy", pct: 16 },
  ],
  "Bag Snacks": [
    { product: "Soft Drinks", pct: 51 },
    { product: "Dip / salsa", pct: 36 },
    { product: "Sandwich bread", pct: 28 },
    { product: "Lunch meat", pct: 24 },
    { product: "Cheese singles", pct: 22 },
    { product: "Cookies", pct: 20 },
    { product: "Crackers", pct: 19 },
    { product: "Juice boxes", pct: 15 },
  ],
  "Cold Cereal": [
    { product: "Fluid Milk", pct: 58 },
    { product: "Bananas", pct: 35 },
    { product: "Yogurt cups", pct: 30 },
    { product: "Orange Juice", pct: 26 },
    { product: "Berries (frozen)", pct: 21 },
    { product: "Granola bars", pct: 19 },
    { product: "Paper bowls", pct: 14 },
    { product: "Honey / syrup", pct: 12 },
  ],
  "Soft Drinks": [
    { product: "Bag Snacks", pct: 47 },
    { product: "Frozen Pizza", pct: 29 },
    { product: "Ice Cream", pct: 27 },
    { product: "Sandwich buns", pct: 22 },
    { product: "Hot dogs", pct: 20 },
    { product: "Chocolate Candy", pct: 18 },
    { product: "Cookies", pct: 17 },
    { product: "Bottled Water", pct: 16 },
  ],
  "Ice Cream": [
    { product: "Cones / toppings", pct: 41 },
    { product: "Chocolate syrup", pct: 33 },
    { product: "Whipped topping", pct: 30 },
    { product: "Soft Drinks", pct: 28 },
    { product: "Cookies", pct: 24 },
    { product: "Paper bowls", pct: 19 },
    { product: "Frozen fruit", pct: 16 },
    { product: "Sprinkles / mix-ins", pct: 14 },
  ],
  "BBQ Meats": [
    { product: "Hot Dog Buns", pct: 58 },
    { product: "Hamburger Buns", pct: 52 },
    { product: "Condiments (ketchup/mustard)", pct: 41 },
    { product: "Bag Snacks", pct: 36 },
    { product: "Soft Drinks", pct: 34 },
    { product: "Shredded Cheese", pct: 28 },
    { product: "Paper Plates", pct: 22 },
    { product: "Frozen Patties", pct: 21 },
  ],
};

const PAIR_HINTS: Record<DemandCategory, RegExp> = {
  "Canned Soup": /soup|broth|milk|bread|banana|cheese|cereal|noodle|cracker|juice|chip|dog|bun|patty|beef|meat/i,
  "Hot Beverages": /coffee|tea|cocoa|cream|milk|sugar|sweet|drink|juice|water|chip|candy|cookie/i,
  "Pasta & Sauce": /pasta|sauce|cheese|beef|pork|biscuit|seasoning|mexican|lean|cream|salad/i,
  "Frozen Pizza": /pizza|frozen|chip|snack|ice|drink|bun|patty|beef|meat|dog|cone|candy/i,
  "Bag Snacks": /chip|snack|drink|juice|bread|meat|cheese|dip|salsa|cookie|candy|dog|bun/i,
  "Cold Cereal": /cereal|milk|juice|banana|yogurt|berry|bar|honey|bowl|oat/i,
  "Soft Drinks": /drink|chip|pizza|ice|cream|cookie|candy|bun|dog|water|juice|snack/i,
  "Ice Cream": /ice|cream|cone|chocolate|cookie|candy|drink|chip|topping|fruit|bowl/i,
  "BBQ Meats": /bbq|grill|dog|bun|patty|hamburger|beef|meat|pork|biscuit|chip|drink|cheese/i,
};

function companionsForDemandCategory(
  unified: Record<string, unknown> | null,
  category: DemandCategory
): Array<{ product: string; pct: number }> {
  if (category === "Canned Soup") {
    const soup = readSoupCompanions(unified);
    if (soup.length) return soup;
  }
  const staticRows = STATIC_DEMAND_COMPANIONS[category];
  if (staticRows.length) return staticRows;
  return readSoupCompanions(unified);
}

function crossPairsForDemandCategory(
  unified: Record<string, unknown> | null,
  category: DemandCategory
): Array<{ pair: string; lift: string; support: string }> {
  const basket = unified?.basket_analysis as Record<string, unknown> | undefined;
  const rows =
    (basket?.top_cross_dept_pairs as Array<{ pair?: string; lift?: number }> | undefined) ?? [];
  const hint = PAIR_HINTS[category];
  const byHint = rows.filter((r) => hint.test(String(r.pair ?? "")));
  const keyedRows = crossPairsForBasketAnchor(unified, mapDemandCategoryToAnchorKey(category));
  const toRow = (p: { pair?: string; lift?: number }) => ({
    pair: String(p.pair ?? ""),
    lift: `${Number(p.lift ?? 0)}x`,
    support: "—",
  });
  const out: Array<{ pair: string; lift: string; support: string }> = [];
  const seen = new Set<string>();
  const pushUnique = (list: Array<{ pair: string; lift: string; support: string }>) => {
    for (const r of list) {
      if (!r.pair || seen.has(r.pair)) continue;
      seen.add(r.pair);
      out.push(r);
      if (out.length >= 8) return;
    }
  };
  pushUnique(byHint.map(toRow).filter((r) => r.pair));
  if (out.length < 8) pushUnique(keyedRows);
  if (out.length < 8) pushUnique(rows.map(toRow).filter((r) => r.pair));
  return out.slice(0, 8);
}

function anchorRateForDemandCategory(category: DemandCategory): { rate: string; label: string } {
  const labelSuffix = category === "Canned Soup" ? "Soup basket rate" : `${category} basket rate (est.)`;
  const rates: Record<DemandCategory, string> = {
    "Canned Soup": "48%",
    "Hot Beverages": "~36%",
    "Pasta & Sauce": "~41%",
    "Frozen Pizza": "~39%",
    "Bag Snacks": "~44%",
    "Cold Cereal": "~46%",
    "Soft Drinks": "~43%",
    "Ice Cream": "~37%",
    "BBQ Meats": "~42%",
  };
  return { rate: rates[category], label: labelSuffix };
}

function formatRetailAnalyticsForPrompt(unified: Record<string, unknown> | null): string {
  const ra = unified?.retail_analytics as Record<string, unknown> | undefined;
  if (!ra) return "";
  const lines: string[] = [];
  const grocery = ra.grocery_listings_by_month as
    | Array<{ month?: string; mean_list_price?: number; rows_used?: number }>
    | undefined;
  if (grocery?.length) {
    const withPrice = grocery.filter((x) => x.mean_list_price != null).slice(-4);
    if (withPrice.length) {
      lines.push(
        withPrice
          .map((x) => `${x.month ?? "?"} mean list $${x.mean_list_price} (n≈${x.rows_used ?? "?"})`)
          .join("; ")
      );
    }
  }
  const sm = ra.supermarket_sales as Record<string, unknown> | undefined;
  if (sm && !sm.error && typeof sm.total_revenue === "number") {
    const regs = (sm.revenue_by_region as Array<{ region?: string; revenue?: number }> | undefined)?.slice(0, 4) ?? [];
    lines.push(`Supermarket sales CSV total revenue ${sm.total_revenue}; top regions: ${regs.map((r) => `${r.region} $${r.revenue}`).join(", ")}`);
  }
  const wx = ra.toronto_daily_weather_file as Record<string, unknown> | undefined;
  const l90 = wx?.last_90_days as Record<string, unknown> | undefined;
  if (l90 && (l90.avg_temp_c != null || l90.total_precip_mm != null)) {
    lines.push(`Toronto daily weather (last 90 rows in file): avg ${l90.avg_temp_c ?? "?"}C, precip sum ${l90.total_precip_mm ?? "?"}mm`);
  }
  const macro = ra.macro_cma as Record<string, unknown> | undefined;
  const cpi = macro?.cpi as Record<string, unknown> | undefined;
  const un = macro?.unemployment_rate as Record<string, unknown> | undefined;
  if (cpi?.value != null) lines.push(`Toronto CPI latest column ${cpi.latest_period}: ${cpi.value}`);
  if (un?.value != null) lines.push(`Toronto unemployment (${un.latest_period}): ${un.value}%`);
  if (!lines.length) return "";
  return `\nExternal retail CSV layer (merged from local folder):\n${lines.map((l) => `- ${l}`).join("\n")}`;
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
  const retailBlock  = formatRetailAnalyticsForPrompt(unified);

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
${retailBlock || ""}

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

app.get("/api/datasets", (_req, res) => {
  try {
    if (!fs.existsSync(KAGGLE_SOURCES_PATH)) {
      res.status(404).json({ error: "datasets catalog not found", path: KAGGLE_SOURCES_PATH });
      return;
    }
    const raw = fs.readFileSync(KAGGLE_SOURCES_PATH, "utf8");
    res.json(JSON.parse(raw) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/basket-insights", async (req, res) => {
  try {
    const city = getCityByName(typeof req.query.city === "string" ? req.query.city : undefined);
    const base = await fetchWeather(city);
    let threshold = WEATHER_THRESHOLD;
    if (typeof req.query.threshold === "string") {
      const t = Number(req.query.threshold);
      if (Number.isFinite(t)) threshold = t;
    }
    const trigger = evaluateTrigger(base.forecast as ForecastDay[], threshold);
    const windowSet = new Set(trigger.windowDates);
    const forecast = base.forecast.map((day) => ({
      ...day,
      inTriggerWindow: windowSet.has(day.date)
    }));
    const today = forecast[0]?.date ?? new Date().toISOString().slice(0, 10);
    const season = calendarSeasonFromIsoDate(today);
    const scenario = deriveBasketScenario(trigger);
    const scenarioLabel = basketScenarioLabel(scenario);
    const categoryRaw = typeof req.query.category === "string" ? req.query.category : "";
    const demandCategory: DemandCategory | null = isDemandCategory(categoryRaw) ? categoryRaw : null;
    const autoAnchor = pickBasketAnchor(scenario, season);
    const unified = readUnifiedSignal();
    const anchor = demandCategory
      ? {
          key: mapDemandCategoryToAnchorKey(demandCategory),
          label: `${demandCategory} basket lens`,
          rationale: `Companion and pair emphasis follows **${demandCategory}** for ${city.name}; trip context remains ${scenarioLabel}.`
        }
      : autoAnchor;
    const companions = demandCategory
      ? companionsForDemandCategory(unified, demandCategory)
      : companionsForBasketAnchor(unified, anchor.key);
    const pairs = demandCategory
      ? crossPairsForDemandCategory(unified, demandCategory)
      : crossPairsForBasketAnchor(unified, anchor.key);
    const meta = (unified?.meta as Record<string, unknown> | undefined) ?? {};
    const lastUpdated = typeof meta.last_updated === "string" ? meta.last_updated : undefined;
    const { rate: anchorBasketRate, label: anchorRateLabel } = demandCategory
      ? anchorRateForDemandCategory(demandCategory)
      : {
          rate:
            anchor.key === "soup" ? "48%" : anchor.key === "bbq" ? "~42%" : anchor.key === "produce" ? "~38%" : "~35%",
          label: anchor.key === "soup" ? "Soup basket rate" : `${anchor.label} basket rate (est.)`
        };
    const callout = [
      `${getSeasonLabel(trigger.avgTemp)} (${scenarioLabel}).`,
      anchor.rationale,
      demandCategory
        ? `Dashboard category lens: **${demandCategory}** (priority ideas by temperature: ${getCategoryFocus(trigger.avgTemp)}).`
        : `Priority categories aligned with the dashboard: ${getCategoryFocus(trigger.avgTemp)}.`
    ].join(" ");

    res.json({
      city: city.name,
      season,
      scenario,
      scenarioLabel,
      anchor,
      demandCategory: demandCategory ?? undefined,
      thresholdUsed: threshold,
      trigger,
      forecast,
      companions,
      pairs,
      kpis: {
        totalBaskets: "275K+",
        households: "2,500",
        dataPeriod: "2 years",
        anchorBasketRate,
        anchorRateLabel
      },
      callout,
      meta: { last_updated: lastUpdated }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
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
  console.log(`CPG dashboard API server listening on port ${PORT}`);
});

server.keepAliveTimeout = 0;
server.on("error",              (err) => console.error("Server error:", err));
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection",(err) => console.error("Unhandled:", err));
process.on("exit",              (code) => console.log("Process exiting with code:", code));
process.on("beforeExit",        (code) => console.log("Before exit, code:", code));
