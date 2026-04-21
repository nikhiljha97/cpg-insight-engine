/**
 * Shared 3-day (forecast days 2–4) activation rules for cold-wet vs hot-dry promos.
 * Kept in one module so Dashboard, API routes, and tests stay aligned.
 */
/** WMO codes that imply measurable precip or dense moisture (fog). */
export const WMO_WET_WEATHER_CODES = new Set([
  45,
  48, // fog / depositing rime fog
  51,
  53,
  55,
  61,
  63,
  65,
  71,
  73,
  75,
  77,
  80,
  81,
  82,
  85,
  86,
  95,
  96,
  99,
]);

/**
 * mm — any strictly positive daily `precipitation_sum` counts as a wet day when WMO code is still "dry"
 * (e.g. overcast with trace rain). Uses a tiny epsilon so float noise does not count as wet.
 */
export const PRECIP_WET_EPSILON_MM = 1e-6;

export function isWetForecastDay(d: ForecastSliceDay): boolean {
  if (WMO_WET_WEATHER_CODES.has(d.weatherCode)) return true;
  const mm = d.precipitationMm;
  return typeof mm === "number" && Number.isFinite(mm) && mm > PRECIP_WET_EPSILON_MM;
}

export type ForecastSliceDay = {
  date: string;
  tempAvg: number;
  weatherCode: number;
  precipitationMm?: number;
};

export type WeatherActivation = {
  /** True if either cold-wet or hot-dry window is active */
  triggered: boolean;
  coldTriggered: boolean;
  hotTriggered: boolean;
  avgTemp: number;
  wetDays: number;
  coldThreshold: number;
  hotThreshold: number;
  windowDates: string[];
};

export function computeWeatherActivations(
  forecast: ForecastSliceDay[],
  coldThreshold: number,
  hotThreshold: number
): WeatherActivation | null {
  const window = forecast.slice(1, 4);
  if (!window.length) return null;
  const avgTemp = Number(
    (window.reduce((s, d) => s + d.tempAvg, 0) / window.length).toFixed(1)
  );
  const wetDays = window.filter((d) => isWetForecastDay(d)).length;
  const windowDates = window.map((d) => d.date);
  const coldTriggered = avgTemp < coldThreshold && wetDays > 0;
  const hotTriggered = avgTemp > hotThreshold && wetDays === 0;
  return {
    triggered: coldTriggered || hotTriggered,
    coldTriggered,
    hotTriggered,
    avgTemp,
    wetDays,
    coldThreshold,
    hotThreshold,
    windowDates,
  };
}
