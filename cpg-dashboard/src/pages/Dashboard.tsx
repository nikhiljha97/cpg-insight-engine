import { apiUrl } from "../api";
import CategorySignals from "./CategorySignals";
import NlqPanel from "../components/NlqPanel";
import { useEffect, useMemo, useState, useRef } from "react";
import { useWeatherContext } from "./WeatherContext";
import LastUpdated from "./LastUpdated";
import {
  CATEGORY_DEMAND,
  DEMAND_CATEGORY_LIST,
  isDemandCategory,
} from "../constants/demandCategories";
import { computeWeatherActivations } from "../lib/weatherTriggers";
import { aggregateQuarterly, lastNQuarters } from "../lib/ontarioRetailQuarterly";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type City = { name: string; lat: number; lon: number };
type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  tempAvg: number;
  precipitationMm: number;
  weatherCode: number;
  weatherLabel: string;
  inTriggerWindow: boolean;
  emoji: string;
};
type Trigger = {
  triggered: boolean;
  coldTriggered?: boolean;
  hotTriggered?: boolean;
  avgTemp: number;
  wetDays: number;
  threshold: number;
  hotThreshold?: number;
  windowDates: string[];
};
type WeatherResponse = {
  city: City;
  forecast: ForecastDay[];
  trigger: Trigger;
};

type RetailDataPoint = {
  refPer: string;
  value: number;
};

type OntarioRetailSeriesMeta = {
  seriesKind: "ontario_total_retail_sa" | "ontario_naics_unadjusted" | "fallback_scaled_total_sa";
  table?: string;
  vectorId?: number;
  statcanSeriesTitle?: string;
  notes?: string;
};

type TrafficEvent = {
  Description?: string;
  EventType?: string;
  County?: string;
};

type MacroStripGrocery = {
  mergedAt?: string;
  latestMonth: string;
  meanListPrice: number;
  medianListPrice?: number;
  prevMonth?: string;
  momPctMean: number | null;
  series: Array<{ month: string; mean: number; median?: number }>;
};

type MacroStripPayload = {
  grocery: MacroStripGrocery | null;
  cpi: { value: number; latest_period: string; city?: string } | null;
};

type DisruptionLevel = "Low" | "Moderate" | "High";

/* ─── Demand Curve Config (Dunnhumby + extended categories) ─────────────── */

const DEMAND_BANDS = [
  { label: "> 20°C",  min: 20,        max: Infinity, uplift: -15 },
  { label: "15–20°C", min: 15,        max: 20,       uplift: 0   },
  { label: "10–15°C", min: 10,        max: 15,       uplift: 18  },
  { label: "5–10°C",  min: 5,         max: 10,       uplift: 34  },
  { label: "0–5°C",   min: 0,         max: 5,        uplift: 51  },
  { label: "< 0°C",   min: -Infinity, max: 0,        uplift: 67  },
];

function getActiveBand(avgTemp: number) {
  return DEMAND_BANDS.findIndex(
    (b) => avgTemp >= b.min && avgTemp < b.max
  );
}

function getDisruptionLevel(count: number): DisruptionLevel {
  if (count <= 2) return "Low";
  if (count <= 6) return "Moderate";
  return "High";
}

function formatStatCanMonth(refPer: string): string {
  try {
    const iso = refPer.length === 7 ? `${refPer}-01` : refPer;
    const d = new Date(iso + (iso.includes("T") ? "" : "T12:00:00Z"));
    return d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return refPer;
  }
}

/** StatCan API returns Ontario totals in millions CAD — display whole millions. */
function formatOntarioRetailMillionsCAD(value: number): string {
  return `${Math.round(value).toLocaleString("en-CA")} M$`;
}

function formatOntarioRetailDeltaMillionsCAD(diff: number): string {
  const r = Math.round(diff);
  return `${r >= 0 ? "+" : ""}${r.toLocaleString("en-CA")} M$`;
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

function Skeleton({ w, h, radius = 6 }: { w: string; h: number; radius?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: "linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

function OntarioQuarterSparkline({ values }: { values: number[] }) {
  const w = 320;
  const h = 96;
  const pad = 10;
  if (values.length === 0) return null;
  if (values.length === 1) {
    return (
      <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0" }}>
        One quarter in view — more monthly history unlocks a trend line.
      </p>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = w - 2 * pad;
  const innerH = h - 2 * pad;
  const coords = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * innerW;
    const y = pad + (1 - (v - min) / span) * innerH;
    return { x, y, v };
  });
  const pointsAttr = coords.map((c) => `${c.x},${c.y}`).join(" ");
  return (
    <div style={{ marginTop: 12 }}>
      <p
        style={{
          fontSize: 11,
          color: "#64748b",
          margin: "0 0 4px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Quarterly total (M$)
      </p>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: "block", maxHeight: 100 }}
        aria-hidden
      >
        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsAttr}
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="#0e7490" stroke="#67e8f9" strokeWidth={1} />
        ))}
      </svg>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#334155",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 700,
          cursor: "help",
          lineHeight: 1,
        }}
      >
        ?
      </span>
      {visible && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#cbd5e1",
            lineHeight: 1.6,
            width: 280,
            zIndex: 100,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function Dashboard() {
  /* Global context — share city + temp with other tabs */
  const {
    selectedCity,
    setSelectedCity,
    setAvgTemp,
    threshold,
    setThreshold,
    hotThreshold,
    setHotThreshold,
    setWetDays,
    setColdPromoActive,
    setHotPromoActive,
    demandCategory,
    setDemandCategory,
  } = useWeatherContext();

  /* State */
  const [fetchedAt, setFetchedAt] = useState<number|null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // StatCan retail (per demand category — Ontario NAICS via WDS when available)
  const [retailData, setRetailData] = useState<RetailDataPoint[]>([]);
  const [retailMeta, setRetailMeta] = useState<OntarioRetailSeriesMeta | null>(null);
  const [retailLoading, setRetailLoading] = useState(true);
  const [retailError, setRetailError] = useState(false);

  // 511 traffic
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState(false);

  const [macroStrip, setMacroStrip] = useState<MacroStripPayload | null>(null);
  const [macroLoading, setMacroLoading] = useState(true);

  const pitchRef = useRef<HTMLTextAreaElement>(null);

  /* ── Fetch cities ─────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch(apiUrl("/api/cities"))
      .then((r) => r.json())
      .then((data) => { setCities(data); })
      .catch(() => setError("Failed to load cities."));
  }, []);

  /* ── Fetch weather ────────────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setError("");
    setWeather(null);
    setPitch("");
    const q = new URLSearchParams({
      city: selectedCity,
      threshold: String(threshold),
      hotThreshold: String(hotThreshold),
    });
    fetch(apiUrl(`/api/weather?${q.toString()}`))
      .then((r) => {
        if (!r.ok) throw new Error("Weather fetch failed");
        return r.json();
      })
      .then((data: WeatherResponse) => {
        setWeather(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load weather data. Please try again.");
        setLoading(false);
      });
  }, [selectedCity, threshold, hotThreshold]);

  /* ── Sync shared weather activation flags (same rules as KPI / shared lib) ─ */
  useEffect(() => {
    if (!weather?.forecast?.length) return;
    const act = computeWeatherActivations(
      weather.forecast.map((d) => ({
        date: d.date,
        tempAvg: d.tempAvg,
        weatherCode: d.weatherCode,
        precipitationMm: d.precipitationMm,
      })),
      threshold,
      hotThreshold
    );
    if (!act) return;
    setAvgTemp(act.avgTemp);
    setWetDays(act.wetDays);
    setColdPromoActive(act.coldTriggered);
    setHotPromoActive(act.hotTriggered);
  }, [weather, threshold, hotThreshold, setAvgTemp, setWetDays, setColdPromoActive, setHotPromoActive]);

  /* ── Fetch StatCan Ontario industry retail (NAICS via WDS) per food category ─ */
  useEffect(() => {
    setRetailLoading(true);
    setRetailError(false);
    const q = new URLSearchParams({ demandCategory });
    fetch(apiUrl(`/api/statcan/ontario-retail?${q.toString()}`))
      .then((r) => {
        if (!r.ok) throw new Error("StatCan error");
        return r.json();
      })
      .then(
        (json: {
          data: Array<{ period: string; value: number }>;
          trend: string;
          latestValue: number;
          changePercent: number;
          meta?: OntarioRetailSeriesMeta;
        }) => {
          const obs: RetailDataPoint[] = (json?.data ?? []).map((pt) => ({
            refPer: pt.period,
            value: pt.value,
          }));
          setRetailData(obs);
          setRetailMeta(json?.meta ?? null);
          setRetailLoading(false);
        }
      )
      .catch(() => {
        setRetailError(true);
        setRetailMeta(null);
        setRetailLoading(false);
      });
  }, [demandCategory]);

  /* ── GTA traffic + macro strip in parallel (faster first paint) ──────── */
  useEffect(() => {
    let cancelled = false;
    setTrafficLoading(true);
    setTrafficError(false);
    setMacroLoading(true);
    const trafficP = fetch(apiUrl("/api/traffic/gta")).then((r) => {
      if (!r.ok) throw new Error("511 error");
      return r.json() as Promise<{
        incidentCount: number;
        disruptionLevel: string;
        topEvents: Array<{ description: string; county: string; road: string }>;
      }>;
    });
    const macroP = fetch(apiUrl("/api/signals/macro-strip")).then((r) => r.json() as Promise<MacroStripPayload>);
    Promise.all([trafficP, macroP])
      .then(([data, j]) => {
        if (cancelled) return;
        const events: TrafficEvent[] = (data.topEvents ?? []).map((e) => ({
          Description: e.description,
          County: e.county,
          EventType: "Incident",
        }));
        setTrafficEvents(events);
        setMacroStrip(j);
      })
      .catch(() => {
        if (!cancelled) {
          setTrafficError(true);
          setMacroStrip(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTrafficLoading(false);
          setMacroLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tr = weather?.trigger ?? null;

  /** Recompute lanes from live sliders + forecast so KPIs track slider moves (matches server lib). */
  const activation = useMemo(() => {
    if (!weather?.forecast?.length) return null;
    return computeWeatherActivations(
      weather.forecast.map((d) => ({
        date: d.date,
        tempAvg: d.tempAvg,
        weatherCode: d.weatherCode,
        precipitationMm: d.precipitationMm,
      })),
      threshold,
      hotThreshold
    );
  }, [weather, threshold, hotThreshold]);

  /* ── KPI values ───────────────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    if (!weather) {
      return {
        coldTriggered: false,
        hotTriggered: false,
        anyTriggered: false,
        avgTemp: 0,
        wetDays: 0,
        threshold,
        hotThreshold,
        forecastDays: 0,
      };
    }
    if (activation) {
      return {
        coldTriggered: activation.coldTriggered,
        hotTriggered: activation.hotTriggered,
        anyTriggered: activation.triggered,
        avgTemp: activation.avgTemp,
        wetDays: activation.wetDays,
        threshold: activation.coldThreshold,
        hotThreshold: activation.hotThreshold,
        forecastDays: weather.forecast.length,
      };
    }
    if (!tr) {
      return {
        coldTriggered: false,
        hotTriggered: false,
        anyTriggered: false,
        avgTemp: 0,
        wetDays: 0,
        threshold,
        hotThreshold,
        forecastDays: weather.forecast.length,
      };
    }
    const cold = tr.coldTriggered ?? (tr.triggered && tr.wetDays > 0);
    const hot = tr.hotTriggered ?? false;
    return {
      coldTriggered: !!cold,
      hotTriggered: !!hot,
      anyTriggered: !!(cold || hot),
      avgTemp: tr.avgTemp,
      wetDays: tr.wetDays,
      threshold: tr.threshold,
      hotThreshold: tr.hotThreshold ?? hotThreshold,
      forecastDays: weather.forecast.length,
    };
  }, [weather, activation, tr, threshold, hotThreshold]);

  useEffect(() => {
    if (tr) setFetchedAt(Date.now());
  }, [tr]);

  /* ── Disruption level ─────────────────────────────────────────────────── */
  const disruptionLevel: DisruptionLevel = useMemo(
    () => getDisruptionLevel(trafficEvents.length),
    [trafficEvents]
  );

  /* ── Active demand band ───────────────────────────────────────────────── */
  const activeBandIdx = useMemo(() => {
    const temp = activation?.avgTemp ?? tr?.avgTemp;
    if (temp == null || !Number.isFinite(temp)) return -1;
    return getActiveBand(temp);
  }, [tr, activation]);

  /* ── Selected category uplift values ────────────────────────────────── */
  const categoryUplift = CATEGORY_DEMAND[demandCategory];
  const maxUplift = Math.max(
    ...DEMAND_CATEGORY_LIST.flatMap((k) => Array.from(CATEGORY_DEMAND[k], (n) => Math.abs(n)))
  );

  /* ── Generate pitch ───────────────────────────────────────────────────── */
  async function generatePitch() {
    if (!weather) return;
    setPitchLoading(true);
    setPitch("");
    setError("");
    try {
      const mergedTrigger =
        activation && weather
          ? {
              triggered: activation.triggered,
              coldTriggered: activation.coldTriggered,
              hotTriggered: activation.hotTriggered,
              avgTemp: activation.avgTemp,
              wetDays: activation.wetDays,
              threshold: activation.coldThreshold,
              hotThreshold: activation.hotThreshold,
              windowDates: activation.windowDates,
            }
          : weather.trigger;
      const payload = {
        city: selectedCity,
        weatherData: {
          ...weather,
          trigger: mergedTrigger,
          customThreshold: threshold,
          hotThreshold,
          trafficDisruption: disruptionLevel,
        },
      };
      const res = await fetch(apiUrl("/api/generate-pitch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Pitch generation failed");
      const data = await res.json();
      setPitch(data.pitch ?? data.message ?? JSON.stringify(data));
    } catch {
      setError("Failed to generate pitch. Please try again.");
    } finally {
      setPitchLoading(false);
    }
  }

  /* ── Copy pitch ───────────────────────────────────────────────────────── */
  function copyPitch() {
    if (!pitch) return;
    navigator.clipboard.writeText(pitch).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function triggerBadgeForDay(day: ForecastDay): boolean {
    const idx = weather?.forecast.indexOf(day) ?? -1;
    if (activation) {
      return idx >= 1 && idx <= 3 && !!(activation.coldTriggered || activation.hotTriggered);
    }
    if (!tr) return day.inTriggerWindow;
    const cold = tr.coldTriggered ?? (tr.triggered && tr.wetDays > 0);
    const hot = tr.hotTriggered ?? false;
    return idx >= 1 && idx <= 3 && !!(cold || hot);
  }

  const disruptionColor: Record<DisruptionLevel, string> = {
    Low: "#34d399",
    Moderate: "#fbbf24",
    High: "#f87171",
  };

  /* ── Ontario retail: category-scaled monthly → quarterly window ───────── */
  const categoryRetailMonthly = useMemo(() => {
    if (retailData.length === 0) return [];
    return retailData.map((p) => ({ refPer: p.refPer, value: p.value }));
  }, [retailData]);

  const retailQuartersAsc = useMemo(
    () => aggregateQuarterly(categoryRetailMonthly),
    [categoryRetailMonthly]
  );

  const retailQuartersWindow = useMemo(
    () => lastNQuarters(retailQuartersAsc, 8),
    [retailQuartersAsc]
  );

  const retailTrend = useMemo(() => {
    if (retailQuartersAsc.length < 2) return null;
    const prev = retailQuartersAsc[retailQuartersAsc.length - 2].value;
    const curr = retailQuartersAsc[retailQuartersAsc.length - 1].value;
    return curr >= prev ? "up" : "down";
  }, [retailQuartersAsc]);

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Inline styles */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 20px 24px;
        }
        .dash-card-sm {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 16px 20px;
        }
        .kpi-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          min-height: 148px;
          justify-content: flex-start;
        }
        .kpi-value {
          font-size: 28px;
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.1;
        }
        .kpi-label {
          font-size: 13px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* Slider styling */
        .threshold-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #334155;
          outline: none;
          cursor: pointer;
        }
        .threshold-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
          transition: box-shadow 0.15s;
        }
        .threshold-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 5px rgba(59,130,246,0.35);
        }
        .threshold-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
        }
        .threshold-slider::-moz-range-track {
          background: #334155;
          height: 6px;
          border-radius: 3px;
        }
        .forecast-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .forecast-strip::-webkit-scrollbar { height: 4px; }
        .forecast-strip::-webkit-scrollbar-track { background: #0f172a; border-radius: 2px; }
        .forecast-strip::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .forecast-day {
          flex: 0 0 auto;
          min-width: 80px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
          transition: border-color 0.2s;
        }
        .forecast-day.active-window {
          border-color: #22d3ee;
          background: rgba(34,211,238,0.06);
        }
        .pitch-textarea {
          width: 100%;
          min-height: 140px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 14px;
          line-height: 1.65;
          padding: 14px 16px;
          resize: vertical;
          box-sizing: border-box;
        }
        .btn-primary {
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #2563eb; }
        .btn-primary:disabled { opacity: 0.5; cursor: default; }
        .btn-ghost {
          background: transparent;
          color: #94a3b8;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .btn-ghost:hover { color: #f1f5f9; border-color: #64748b; }
        .section-title {
          font-size: 15px;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: 0.01em;
          margin: 0 0 14px;
        }
        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .badge-triggered {
          background: rgba(34,211,238,0.15);
          color: #22d3ee;
          border: 1px solid rgba(34,211,238,0.3);
        }
        .badge-not-triggered {
          background: rgba(148,163,184,0.1);
          color: #94a3b8;
          border: 1px solid #334155;
        }
        .city-select, .cat-select {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 14px;
          padding: 8px 14px;
          cursor: pointer;
          outline: none;
        }
        .city-select:focus, .cat-select:focus { border-color: #3b82f6; }
        .demand-bar-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .demand-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .demand-label {
          font-size: 12px;
          color: #94a3b8;
          width: 70px;
          flex-shrink: 0;
          text-align: right;
        }
        .demand-bar-track {
          flex: 1;
          height: 18px;
          background: #0f172a;
          border-radius: 4px;
          overflow: visible;
          position: relative;
        }
        .demand-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }
        .demand-bar-fill.positive { background: linear-gradient(90deg, #22d3ee, #34d399); }
        .demand-bar-fill.negative { background: #f87171; }
        .demand-bar-fill.zero { background: #64748b; }
        .demand-bar-active .demand-bar-fill {
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
        }
        .demand-uplift {
          font-size: 12px;
          font-weight: 600;
          width: 46px;
          flex-shrink: 0;
          text-align: right;
        }
        .traffic-event-item {
          font-size: 13px;
          color: #94a3b8;
          border-left: 2px solid #334155;
          padding-left: 10px;
          margin-bottom: 6px;
          line-height: 1.4;
        }
        .retail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #334155;
        }
        .retail-row:last-child { border-bottom: none; }
        .slider-explain {
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 12px;
          font-size: 13px;
          color: #93c5fd;
          line-height: 1.6;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "transparent",
          color: "#f1f5f9",
          fontFamily: "'Inter', 'DM Sans', system-ui, -apple-system, sans-serif",
          fontSize: "15px",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "28px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                margin: 0,
                color: "#f1f5f9",
                letterSpacing: "-0.02em",
              }}
            >
              CPG Analytics Dashboard
            </h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "14px" }}>
              Weather demand · unified macro (listings + CPI) · Ontario retail · GTA traffic
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <LastUpdated fetchedAt={fetchedAt} label="Weather refreshed" />
            <label htmlFor="city-select" style={{ fontSize: "13px", color: "#94a3b8" }}>
              City:
            </label>
            <select
              id="city-select"
              className="city-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              {cities.length === 0 ? (
                <option>{selectedCity}</option>
              ) : (
                cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* ── Macro header strip (retail_analytics) ────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="dash-card-sm" style={{ padding: "14px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
              Retail analytics · sampled listings
            </p>
            {macroLoading ? (
              <div style={{ marginTop: 12 }}>
                <Skeleton w="70%" h={28} />
                <Skeleton w="40%" h={16} />
              </div>
            ) : macroStrip?.grocery ? (
              <>
                <p style={{ margin: "10px 0 4px", fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>
                  ${macroStrip.grocery.meanListPrice.toFixed(2)}{" "}
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>mean</span>
                  {macroStrip.grocery.medianListPrice != null && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                      {" "}
                      · ${macroStrip.grocery.medianListPrice.toFixed(2)} median
                    </span>
                  )}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Latest month {formatStatCanMonth(macroStrip.grocery.latestMonth)}
                  {macroStrip.grocery.momPctMean != null && macroStrip.grocery.prevMonth && (
                    <>
                      {" "}
                      · MoM{" "}
                      <span style={{ color: macroStrip.grocery.momPctMean <= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
                        {macroStrip.grocery.momPctMean >= 0 ? "+" : ""}
                        {macroStrip.grocery.momPctMean}%
                      </span>{" "}
                      vs {formatStatCanMonth(macroStrip.grocery.prevMonth)}
                    </>
                  )}
                </p>
                {macroStrip.grocery.series.length > 1 && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 12, height: 40 }}>
                    {(() => {
                      const vals = macroStrip.grocery.series.map((s) => s.mean);
                      const mx = Math.max(...vals, 1e-6);
                      const trackPx = 36;
                      return macroStrip.grocery.series.map((s) => (
                        <div
                          key={s.month}
                          title={`${s.month}: $${s.mean.toFixed(2)}`}
                          style={{
                            flex: 1,
                            minWidth: 4,
                            height: Math.max(Math.round((s.mean / mx) * trackPx), 5),
                            background: "#22d3ee",
                            borderRadius: 3,
                            opacity: 0.85,
                          }}
                        />
                      ));
                    })()}
                  </div>
                )}
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
                  Kaggle-style monthly rollup in unified_signal (sample caps apply). Not a census of shelf prices.
                </p>
              </>
            ) : (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
                No grocery_listings_by_month in unified_signal — merge retail_analytics into the bundle.
              </p>
            )}
          </div>

          <div className="dash-card-sm" style={{ padding: "14px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
              Greater Toronto · CPI (unified)
            </p>
            {macroLoading ? (
              <div style={{ marginTop: 12 }}>
                <Skeleton w="50%" h={32} />
              </div>
            ) : macroStrip?.cpi ? (
              <>
                <p style={{ margin: "10px 0 4px", fontSize: 26, fontWeight: 800, color: "#a78bfa" }}>
                  {macroStrip.cpi.value}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  {macroStrip.cpi.city ?? "CMA"} · period {macroStrip.cpi.latest_period || "—"}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
                  Pulled from retail_analytics macro tables merged into unified_signal.json.
                </p>
              </>
            ) : (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
                No macro_cma.cpi block in unified_signal.
              </p>
            )}
          </div>
        </div>

        <NlqPanel />

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "#f87171",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Cold + Hot weather activation sliders ───────────────────── */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <p className="section-title" style={{ margin: "0 0 12px" }}>
            Weather activation · next 3 forecast days (days 2–4)
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "#e2e8f0" }}>Cold comfort cut-off</span>
              <Tooltip text="If the 3-day average is below this cut-off AND at least one of those days is wet (WMO rain/snow/drizzle/thunder/fog codes, or any trace daily precip &gt;0 mm from Open-Meteo), the cold comfort lane turns on — soup, hot beverages, pasta, baking." />
            </div>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8" }}>{threshold}°C</span>
          </div>
          <input
            type="range"
            className="threshold-slider"
            min={0}
            max={30}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            aria-label="Cold comfort temperature threshold in degrees Celsius"
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "4px",
              marginBottom: "18px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            <span>0°C — aggressive</span>
            <span>15°C — moderate</span>
            <span>30°C — conservative</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "#e2e8f0" }}>Hot summer cut-off</span>
              <Tooltip text="If the 3-day average is above this cut-off AND none of those days count as wet (same rules as cold lane), the hot promo lane turns on — soft drinks, ice cream, BBQ, outdoor snacks." />
            </div>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#fb923c" }}>{hotThreshold}°C</span>
          </div>
          <input
            type="range"
            className="threshold-slider"
            min={18}
            max={40}
            step={0.5}
            value={hotThreshold}
            onChange={(e) => setHotThreshold(parseFloat(e.target.value))}
            aria-label="Hot summer temperature threshold in degrees Celsius"
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "4px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            <span>18°C — early heat</span>
            <span>28°C — typical summer</span>
            <span>40°C — extreme heat only</span>
          </div>

          {!loading && weather && (
            <p style={{ margin: "14px 0 0", fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
              3-day avg{" "}
              <strong style={{ color: "#f1f5f9" }}>{kpi.avgTemp.toFixed(1)}°C</strong> · Wet-type days in window:{" "}
              <strong style={{ color: "#f1f5f9" }}>{kpi.wetDays}</strong> ·{" "}
              {kpi.coldTriggered ? (
                <span style={{ color: "#22d3ee", fontWeight: 600 }}>✓ Cold comfort lane ACTIVE</span>
              ) : kpi.hotTriggered ? (
                <span style={{ color: "#fb923c", fontWeight: 600 }}>✓ Hot summer lane ACTIVE</span>
              ) : (
                <span style={{ color: "#64748b" }}>No activation — adjust sliders vs this avg, or wait for a wet (cold) or dry-heat (hot) window.</span>
              )}
            </p>
          )}
          <div className="slider-explain" style={{ marginTop: 12 }}>
            <strong style={{ color: "#f1f5f9" }}>How it works:</strong> The engine scores the same three forward days for two independent lanes —{" "}
            <em>cold + wet</em> (WMO precip/fog codes or any trace daily precip) and <em>hot + dry</em> (no wet days). KPIs
            recompute when you move the sliders so you can stress-test cut-offs against the live forecast.
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="kpi-card">
                <Skeleton w="60%" h={14} />
                <Skeleton w="40%" h={28} />
              </div>
            ))
          ) : (
            <>
              <div className="kpi-card">
                <span className="kpi-label">Promo activation</span>
                <span
                  className="kpi-value"
                  style={{
                    color: kpi.anyTriggered ? "#34d399" : "#64748b",
                  }}
                >
                  {kpi.anyTriggered ? (kpi.coldTriggered ? "Cold" : kpi.hotTriggered ? "Hot" : "Active") : "Inactive"}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
                  {kpi.anyTriggered
                    ? kpi.coldTriggered
                      ? "Comfort / wet window"
                      : "Summer / dry window"
                    : (() => {
                        if (kpi.avgTemp < kpi.threshold && kpi.wetDays < 1) {
                          return `Avg ${kpi.avgTemp.toFixed(1)}°C is below your ${kpi.threshold}°C cut — cold lane still needs ≥1 wet day (slice has ${kpi.wetDays}).`;
                        }
                        return `${kpi.wetDays} wet day(s) in slice · ${kpi.avgTemp.toFixed(1)}°C avg vs cold &lt;${kpi.threshold}° / hot &gt;${kpi.hotThreshold}°`;
                      })()}
                </span>
                {!kpi.anyTriggered && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px solid #334155",
                      fontSize: 11,
                      color: "#94a3b8",
                      lineHeight: 1.55,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>Lane gates (sliders update the ✓/✗)</div>
                    <div>
                      <span style={{ color: "#7dd3fc" }}>Cold</span>: avg &lt; {kpi.threshold}°{" "}
                      <strong style={{ color: kpi.avgTemp < kpi.threshold ? "#34d399" : "#f87171" }}>
                        {kpi.avgTemp < kpi.threshold ? "✓" : "✗"}
                      </strong>
                      {" · "}
                      wet days ≥ 1{" "}
                      <strong style={{ color: kpi.wetDays > 0 ? "#34d399" : "#f87171" }}>{kpi.wetDays > 0 ? "✓" : "✗"}</strong>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ color: "#fdba74" }}>Hot</span>: avg &gt; {kpi.hotThreshold}°{" "}
                      <strong style={{ color: kpi.avgTemp > kpi.hotThreshold ? "#34d399" : "#f87171" }}>
                        {kpi.avgTemp > kpi.hotThreshold ? "✓" : "✗"}
                      </strong>
                      {" · "}
                      wet days = 0{" "}
                      <strong style={{ color: kpi.wetDays === 0 ? "#34d399" : "#f87171" }}>{kpi.wetDays === 0 ? "✓" : "✗"}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Cold comfort lane</span>
                <span className="kpi-value" style={{ color: kpi.coldTriggered ? "#22d3ee" : "#64748b" }}>
                  {kpi.coldTriggered ? "Active" : "Off"}
                </span>
                <span
                  className={`badge ${kpi.coldTriggered ? "badge-triggered" : "badge-not-triggered"}`}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  {kpi.coldTriggered ? "Cold ON" : "No cold"}
                </span>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
                  {kpi.coldTriggered ? (
                    <>Avg below {kpi.threshold}°C and slice has rain/snow/fog or trace precip (&gt;0 mm) on ≥1 day.</>
                  ) : kpi.avgTemp < kpi.threshold ? (
                    <>
                      Temp vs <strong style={{ color: "#94a3b8" }}>{kpi.threshold}°C</strong> is met, but the 3-day slice
                      has <strong style={{ color: "#94a3b8" }}>{kpi.wetDays}</strong> wet day(s) — need ≥1 for this lane.
                    </>
                  ) : (
                    <>
                      Avg <strong style={{ color: "#94a3b8" }}>{kpi.avgTemp.toFixed(1)}°C</strong> is not below your{" "}
                      <strong style={{ color: "#94a3b8" }}>{kpi.threshold}°C</strong> cold cut-off — raise the cold
                      slider (higher °C) so this avg qualifies.
                    </>
                  )}
                </p>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Hot summer lane</span>
                <span className="kpi-value" style={{ color: kpi.hotTriggered ? "#fb923c" : "#64748b" }}>
                  {kpi.hotTriggered ? "Active" : "Off"}
                </span>
                <span
                  className={`badge ${kpi.hotTriggered ? "badge-triggered" : "badge-not-triggered"}`}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  {kpi.hotTriggered ? "Hot ON" : "No hot"}
                </span>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
                  {kpi.hotTriggered ? (
                    <>Avg above {kpi.hotThreshold}°C and the slice has zero wet days (dry heat window).</>
                  ) : kpi.wetDays > 0 ? (
                    <>
                      Slice has <strong style={{ color: "#94a3b8" }}>{kpi.wetDays}</strong> wet day(s); hot lane needs a
                      fully dry 3-day window.
                    </>
                  ) : kpi.avgTemp <= kpi.hotThreshold ? (
                    <>
                      Avg <strong style={{ color: "#94a3b8" }}>{kpi.avgTemp.toFixed(1)}°C</strong> is not above your{" "}
                      <strong style={{ color: "#94a3b8" }}>{kpi.hotThreshold}°C</strong> hot cut-off — lower the hot slider
                      (toward 18°C) so this avg qualifies.
                    </>
                  ) : (
                    <>Wet/dry logic should allow hot — check forecast data.</>
                  )}
                </p>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">3-Day Avg Temp</span>
                <span
                  className="kpi-value"
                  style={{
                    color:
                      kpi.avgTemp < kpi.threshold ? "#22d3ee" : kpi.avgTemp > kpi.hotThreshold ? "#fb923c" : "#94a3b8",
                  }}
                >
                  {kpi.avgTemp.toFixed(1)}°C
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Cold &lt;{kpi.threshold}° · Hot &gt;{kpi.hotThreshold}°
                </span>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Wet-type days</span>
                <span className="kpi-value" style={{ color: kpi.wetDays > 0 ? "#34d399" : "#64748b" }}>
                  {kpi.wetDays}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  of {Math.min(3, kpi.forecastDays)} (WMO + precip trace)
                </span>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Forecast Days</span>
                <span className="kpi-value">{kpi.forecastDays}</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  7-day outlook
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Demand Sensitivity Chart ──────────────────────────────────── */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p className="section-title" style={{ margin: 0 }}>Demand Sensitivity</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#94a3b8" }}>Category:</label>
              <select
                className="cat-select"
                value={demandCategory}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isDemandCategory(v)) setDemandCategory(v);
                }}
              >
                {DEMAND_CATEGORY_LIST.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Estimated demand uplift vs. baseline by temperature band · Dunnhumby &amp; internal estimates
          </p>
          <div className="demand-bar-wrap">
            {DEMAND_BANDS.map((band, i) => {
              const isActive = i === activeBandIdx;
              const uplift = categoryUplift[i] ?? 0;
              const isPositive = uplift > 0;
              const isZero = uplift === 0;
              const isNegative = uplift < 0;
              const pct =
                isNegative
                  ? (Math.abs(uplift) / maxUplift) * 100
                  : isZero
                  ? 2
                  : (uplift / maxUplift) * 100;

              return (
                <div
                  key={band.label}
                  className={`demand-row ${isActive ? "demand-bar-active" : ""}`}
                  style={{ opacity: isActive ? 1 : 0.65 }}
                >
                  <span
                    className="demand-label"
                    style={{
                      color: isActive ? "#f1f5f9" : "#94a3b8",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {band.label}
                  </span>
                  <div className="demand-bar-track">
                    <div
                      className={`demand-bar-fill ${
                        isPositive ? "positive" : isNegative ? "negative" : "zero"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    {isActive && (() => {
                      const bandRange = band.max === Infinity
                        ? 10
                        : band.min === -Infinity
                        ? 10
                        : band.max - band.min;
                      const threshPos = band.max === Infinity
                        ? Math.max(0, Math.min(1, (threshold - band.min) / bandRange))
                        : band.min === -Infinity
                        ? 0.5
                        : Math.max(0, Math.min(1, (threshold - band.min) / bandRange));
                      return (
                        <div
                          style={{
                            position: "absolute",
                            top: -3,
                            bottom: -3,
                            left: `${threshPos * 100}%`,
                            width: 2,
                            background: "#fbbf24",
                            borderRadius: 1,
                            opacity: 0.85,
                          }}
                          title={`Trigger threshold: ${threshold}°C`}
                        />
                      );
                    })()}
                  </div>
                  <span
                    className="demand-uplift"
                    style={{
                      color: isPositive
                        ? "#34d399"
                        : isNegative
                        ? "#f87171"
                        : "#64748b",
                    }}
                  >
                    {uplift > 0 ? "+" : ""}
                    {uplift}%
                  </span>
                  {isActive && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#22d3ee",
                        fontWeight: 600,
                        marginLeft: 4,
                        flexShrink: 0,
                      }}
                    >
                      ◀ now
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "#fbbf24",
                borderRadius: 1,
                marginRight: 5,
              }}
            />
            Yellow marker = your trigger threshold ({threshold}°C) position within the active band
          </p>
        </div>

        {/* ── Ontario Retail Index + GTA Traffic (2-col) ───────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* StatCan Retail — quarterly Ontario NAICS (WDS) or scaled fallback */}
          <div className="dash-card">
            <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              Ontario retail · {demandCategory}
              <Tooltip
                text={
                  retailMeta?.seriesKind === "ontario_naics_unadjusted"
                    ? "Pulled live from Statistics Canada’s Web Data Service: Ontario monthly retail sales for the mapped NAICS industry (Table 20-10-0056-02). StatCan does not publish a seasonally adjusted Ontario series for this NAICS row here, so quarters sum raw monthly values (seasonal pattern remains). SKU-level soup vs ice cream is not split in official retail trade."
                    : retailMeta?.seriesKind === "fallback_scaled_total_sa"
                      ? "The NAICS feed was unavailable, so the tile temporarily scales Ontario total retail (Table 20-10-0056-01, seasonally adjusted) by a small illustrative share for this dashboard category."
                      : "Ontario retail macro tied to your food category: official NAICS industry data from StatCan when available, otherwise a scaled provincial total."
                }
              />
            </p>
            <p
              style={{
                margin: "-8px 0 10px",
                fontSize: "13px",
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              {retailMeta?.seriesKind === "ontario_naics_unadjusted" ? (
                <>
                  Quarterly sales (M$ CAD) — {retailMeta.statcanSeriesTitle ?? "Ontario NAICS industry"}.{" "}
                  {retailMeta.table ?? "Statistics Canada Table 20-10-0056-02"}.
                </>
              ) : retailMeta?.seriesKind === "fallback_scaled_total_sa" ? (
                <>
                  Quarterly estimated sales (M$ CAD) — {retailMeta.table ?? "Scaled from Ontario total retail (SA)"}.
                </>
              ) : (
                <>
                  Quarterly sales (M$ CAD) — Statistics Canada Ontario retail context for{" "}
                  <strong>{demandCategory}</strong> (NAICS industry or fallback).
                </>
              )}
            </p>
            {retailLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} w="100%" h={36} />
                ))}
              </div>
            ) : retailError ? (
              <div
                style={{
                  background: "rgba(148,163,184,0.08)",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "14px 16px",
                  color: "#64748b",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                StatCan data temporarily unavailable
              </div>
            ) : retailData.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "14px" }}>
                No retail data available.
              </p>
            ) : retailQuartersWindow.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "14px" }}>Not enough months to build a quarter yet.</p>
            ) : (
              <>
                <OntarioQuarterSparkline values={retailQuartersWindow.map((q) => q.value)} />
                {(() => {
                  const rows = [...retailQuartersWindow].reverse();
                  return rows.map((pt, i) => {
                    const isLatest = i === 0;
                    const older = rows[i + 1];
                    const diff = older != null ? pt.value - older.value : null;
                    return (
                      <div key={pt.label} className="retail-row">
                        <span
                          style={{
                            fontSize: "14px",
                            color: isLatest ? "#f1f5f9" : "#94a3b8",
                            fontWeight: isLatest ? 600 : 400,
                          }}
                        >
                          {pt.label}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              color: isLatest ? "#22d3ee" : "#94a3b8",
                            }}
                          >
                            {formatOntarioRetailMillionsCAD(pt.value)}
                          </span>
                          {isLatest && retailTrend && (
                            <span
                              style={{
                                fontSize: "18px",
                                color: retailTrend === "up" ? "#34d399" : "#f87171",
                              }}
                            >
                              {retailTrend === "up" ? "↑" : "↓"}
                            </span>
                          )}
                          {diff !== null && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: diff >= 0 ? "#34d399" : "#f87171",
                              }}
                            >
                              {diff >= 0 ? "+" : ""}
                              {formatOntarioRetailDeltaMillionsCAD(diff)}
                              <span style={{ color: "#64748b", marginLeft: 4 }}>vs prev Q</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </>
            )}
          </div>

          {/* 511 Traffic */}
          <div className="dash-card">
            <p className="section-title">GTA Traffic Conditions</p>
            <p
              style={{
                margin: "-8px 0 14px",
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Active incidents · Peel, Toronto, York · Ontario 511
            </p>
            {trafficLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton w="50%" h={40} />
                <Skeleton w="100%" h={20} />
                <Skeleton w="100%" h={20} />
              </div>
            ) : trafficError ? (
              <div
                style={{
                  background: "rgba(148,163,184,0.08)",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "14px 16px",
                  color: "#64748b",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                Ontario 511 data temporarily unavailable
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: `${disruptionColor[disruptionLevel]}22`,
                      border: `1px solid ${disruptionColor[disruptionLevel]}55`,
                      borderRadius: 8,
                      padding: "8px 16px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: disruptionColor[disruptionLevel],
                      }}
                    >
                      {disruptionLevel}
                    </span>
                    <br />
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Disruption
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "28px",
                        fontWeight: 700,
                        color: "#f1f5f9",
                      }}
                    >
                      {trafficEvents.length}
                    </span>
                    <br />
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Active events
                    </span>
                  </div>
                </div>
                {trafficEvents.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#64748b" }}>
                    No active incidents reported.
                  </p>
                ) : (
                  <>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        margin: "0 0 8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Top events
                    </p>
                    {trafficEvents.slice(0, 3).map((ev, i) => (
                      <div key={i} className="traffic-event-item">
                        {ev.Description ?? ev.EventType ?? "Incident"}
                        {ev.County && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: "11px",
                              color: "#64748b",
                            }}
                          >
                            · {ev.County}
                          </span>
                        )}
                      </div>
                    ))}
                    {disruptionLevel === "High" && (
                      <p
                        style={{
                          margin: "10px 0 0",
                          fontSize: "13px",
                          color: "#fbbf24",
                        }}
                      >
                        ⚠ High disruption may reduce foot traffic — noted in
                        pitch context
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── 7-day Forecast Strip ─────────────────────────────────────── */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <p className="section-title">7-Day Forecast · {selectedCity}</p>
          {loading ? (
            <div style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} w="80px" h={90} radius={10} />
              ))}
            </div>
          ) : weather ? (
            <div className="forecast-strip">
              {weather.forecast.map((day, i) => {
                const inWindow = triggerBadgeForDay(day);
                return (
                  <div
                    key={day.date}
                    className={`forecast-day ${inWindow ? "active-window" : ""}`}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginBottom: 4,
                      }}
                    >
                      {i === 0
                        ? "Today"
                        : new Date(day.date + "T12:00:00Z").toLocaleDateString(
                            "en-CA",
                            { weekday: "short", timeZone: "UTC" }
                          )}
                    </div>
                    <div style={{ fontSize: "22px", lineHeight: 1.2 }}>
                      {day.emoji}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#f1f5f9",
                        marginTop: 4,
                      }}
                    >
                      {day.tempMax}° / {day.tempMin}°
                    </div>
                    {day.precipitationMm > 0 && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#7dd3fc",
                          marginTop: 2,
                        }}
                      >
                        {day.precipitationMm.toFixed(1)}mm
                      </div>
                    )}
                    {inWindow && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-triggered">
                          trigger
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Weather-Driven Category Signals ─────────────────── */}
        {weather && (
          <CategorySignals
            avgTemp={weather ? kpi.avgTemp : 0}
            threshold={threshold}
            hotThreshold={hotThreshold}
            coldPromoActive={kpi.coldTriggered}
            hotPromoActive={kpi.hotTriggered}
          />
        )}

        {/* ── Generate Pitch ────────────────────────────────────────────── */}
        <div className="dash-card">
          <p className="section-title">Generate Retail Pitch</p>
          <p
            style={{
              margin: "-8px 0 16px",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            AI-generated pitch using weather trigger, traffic signal, and
            threshold = {threshold}°C
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: pitch ? "16px" : 0,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn-primary"
              onClick={generatePitch}
              disabled={pitchLoading || loading || !weather}
            >
              {pitchLoading ? "Generating…" : "Generate Pitch"}
            </button>
            {pitch && (
              <button className="btn-ghost" onClick={copyPitch}>
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            )}
          </div>

          {pitchLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 16,
              }}
            >
              <Skeleton w="100%" h={18} />
              <Skeleton w="90%" h={18} />
              <Skeleton w="95%" h={18} />
              <Skeleton w="80%" h={18} />
            </div>
          )}

          {pitch && !pitchLoading && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <textarea
                ref={pitchRef}
                className="pitch-textarea"
                readOnly
                value={pitch}
                aria-label="Generated pitch"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
