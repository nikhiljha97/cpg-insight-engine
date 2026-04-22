/**
 * MVP demand index forecast: StatCan monthly Ontario NAICS (per category) → implied weekly baseline,
 * adjusted forward with Canadian holiday windows, simple seasonality, and next-week weather context.
 * Not a certified planning system — transparent heuristics for dashboard storytelling.
 */
import type { DemandCategory } from "../src/constants/demandCategories.js";
import { fetchStatcanVectorMonthlyMillions } from "./statcanWds.js";
import { DEMAND_CATEGORY_STATCAN_VECTOR } from "./demandCategoryStatcan.js";

export type ForecastDayLite = {
  date: string;
  tempAvg: number;
  precipitationMm: number;
  weatherCode: number;
};

/** Approximate Canadian retail-relevant holiday windows (local calendar). Boost stacks lightly if overlapping. */
const HOLIDAY_WINDOWS: { name: string; month: number; startDay: number; endDay: number; boost: number }[] = [
  { name: "New Year", month: 1, startDay: 1, endDay: 7, boost: 0.04 },
  { name: "Family Day (approx.)", month: 2, startDay: 14, endDay: 21, boost: 0.03 },
  { name: "Spring grocery (approx.)", month: 3, startDay: 10, endDay: 31, boost: 0.03 },
  { name: "Spring grocery (approx.)", month: 4, startDay: 1, endDay: 14, boost: 0.03 },
  { name: "Victoria Day (approx.)", month: 5, startDay: 18, endDay: 25, boost: 0.04 },
  { name: "Canada Day", month: 7, startDay: 1, endDay: 7, boost: 0.06 },
  { name: "Civic holiday (approx.)", month: 8, startDay: 1, endDay: 7, boost: 0.03 },
  { name: "Labour Day (approx.)", month: 9, startDay: 1, endDay: 7, boost: 0.04 },
  { name: "Thanksgiving (Canada, approx.)", month: 10, startDay: 6, endDay: 14, boost: 0.08 },
  { name: "Halloween lead-up", month: 10, startDay: 20, endDay: 31, boost: 0.04 },
  { name: "Remembrance week", month: 11, startDay: 6, endDay: 12, boost: 0.02 },
  { name: "Christmas / Boxing", month: 12, startDay: 15, endDay: 31, boost: 0.1 },
];

const COMFORT_CATEGORIES = new Set<DemandCategory>([
  "Canned Soup",
  "Hot Beverages",
  "Pasta & Sauce",
  "Cold Cereal",
]);

const SUMMER_CATEGORIES = new Set<DemandCategory>([
  "Ice Cream",
  "Soft Drinks",
  "BBQ Meats",
  "Bag Snacks",
]);

function weekOverlapsHoliday(weekStart: Date): number {
  const y = weekStart.getFullYear();
  let boost = 0;
  for (const w of HOLIDAY_WINDOWS) {
    const start = new Date(y, w.month - 1, w.startDay);
    const end = new Date(y, w.month - 1, w.endDay);
    if (end < start) end.setFullYear(y + 1);
    const ws = new Date(weekStart);
    const we = new Date(weekStart);
    we.setDate(we.getDate() + 6);
    if (we < start || ws > end) continue;
    boost += w.boost;
  }
  return Math.min(boost, 0.18);
}

function isoMondayOnOrAfter(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

function nextWeeklyHorizon(weeks: number): Date[] {
  const start = isoMondayOnOrAfter(new Date());
  const out: Date[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = new Date(start);
    w.setDate(start.getDate() + i * 7);
    out.push(w);
  }
  return out;
}

function weekOfYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
}

function lastNMonthlyAverage(values: number[], n: number): number {
  const slice = values.slice(-n);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function impliedWeeklyFromMonthly(monthlyAvgMillions: number): number {
  return monthlyAvgMillions / 4.345;
}

export type DemandForecastWeek = {
  weekStart: string;
  index: number;
  indexLow: number;
  indexHigh: number;
  drivers: string[];
};

export async function buildDemandForecastMvp(opts: {
  category: DemandCategory;
  forecastDays: ForecastDayLite[];
  coldTriggered: boolean;
  hotTriggered: boolean;
  wetDaysInActivationWindow: number;
}): Promise<{
  category: DemandCategory;
  weeks: DemandForecastWeek[];
  baselineWeeklyMillions: number;
  methodology: string;
}> {
  const vectorId = DEMAND_CATEGORY_STATCAN_VECTOR[opts.category];
  const monthly = await fetchStatcanVectorMonthlyMillions(vectorId);
  if (monthly.length < 6) {
    throw new Error("Insufficient StatCan monthly history for forecast");
  }
  const vals = monthly.map((m) => m.value);
  const ma3 = lastNMonthlyAverage(vals, 3);
  const ma6 = lastNMonthlyAverage(vals, 6);
  const baselineMonthly = ma3 * 0.65 + ma6 * 0.35;
  const baselineWeekly = impliedWeeklyFromMonthly(baselineMonthly);
  if (baselineWeekly <= 0) throw new Error("Invalid baseline weekly demand");

  const weeks = nextWeeklyHorizon(6);

  const out: DemandForecastWeek[] = [];

  for (let i = 0; i < weeks.length; i++) {
    const ws = weeks[i]!;
    const drivers: string[] = [];
    const seasonal = 1 + 0.045 * Math.sin((weekOfYear(ws) / 52) * 2 * Math.PI);
    drivers.push(`Seasonality factor ${seasonal.toFixed(3)}`);

    const hol = weekOverlapsHoliday(ws);
    let mult = seasonal * (1 + hol);
    if (hol > 0) drivers.push(`Holiday uplift +${(hol * 100).toFixed(1)}% (approx. windows)`);

    const next7 = opts.forecastDays.slice(0, 7);
    const avgT = next7.length ? next7.reduce((s, d) => s + d.tempAvg, 0) / next7.length : 12;
    const wetNext7 = next7.filter((d) =>
      [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(d.weatherCode)
    ).length;

    let weatherAdj = 1;
    if (COMFORT_CATEGORIES.has(opts.category) && opts.coldTriggered && opts.wetDaysInActivationWindow >= 1) {
      weatherAdj += Math.min(0.07, 0.012 * opts.wetDaysInActivationWindow);
      drivers.push("Comfort-food weather lift (cold + wet activation)");
    }
    if (SUMMER_CATEGORIES.has(opts.category) && opts.hotTriggered) {
      weatherAdj += 0.045;
      drivers.push("Warm-weather category lift (hot-dry activation)");
    }
    if (SUMMER_CATEGORIES.has(opts.category) && avgT > 22 && wetNext7 === 0) {
      weatherAdj += 0.025;
      drivers.push("Extended warm dry outlook");
    }

    mult *= weatherAdj;
    if (weatherAdj > 1) drivers.push(`Weather composite adj. ×${weatherAdj.toFixed(3)}`);

    const forecastWeekly = baselineWeekly * mult;
    const index = Math.round((forecastWeekly / baselineWeekly) * 1000) / 10;
    const band = 2.2 + i * 0.35;
    const indexLow = Math.max(85, Math.round((index - band) * 10) / 10);
    const indexHigh = Math.min(118, Math.round((index + band) * 10) / 10);

    out.push({
      weekStart: ws.toISOString().slice(0, 10),
      index,
      indexLow,
      indexHigh,
      drivers,
    });
  }

  return {
    category: opts.category,
    weeks: out,
    baselineWeeklyMillions: Math.round(baselineWeekly * 100) / 100,
    methodology:
      "Heuristic index: trailing 3/6-month StatCan Ontario NAICS monthly sales → implied weekly baseline; forward weeks apply smooth seasonality, approximate Canadian holiday retail windows, and short-horizon weather activation flags from your Open-Meteo slice. Index 100 ≈ baseline implied weekly demand. Use for directional planning only.",
  };
}
