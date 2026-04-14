import { apiUrl } from "../api";
import { useEffect, useMemo, useState, useRef } from "react";

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
  avgTemp: number;
  wetDays: number;
  threshold: number;
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

type TrafficEvent = {
  Description?: string;
  EventType?: string;
  County?: string;
};

type DisruptionLevel = "Low" | "Moderate" | "High";

/* ─── Demand Curve Config (Dunnhumby) ───────────────────────────────────── */

const DEMAND_BANDS = [
  { label: "> 20°C", min: 20, max: Infinity, uplift: -15 },
  { label: "15–20°C", min: 15, max: 20, uplift: 0 },
  { label: "10–15°C", min: 10, max: 15, uplift: 18 },
  { label: "5–10°C", min: 5, max: 10, uplift: 34 },
  { label: "0–5°C", min: 0, max: 5, uplift: 51 },
  { label: "< 0°C", min: -Infinity, max: 0, uplift: 67 },
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
  // refPer looks like "2024-11-01" → "Nov 2024"
  try {
    const d = new Date(refPer + "T12:00:00Z");
    return d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return refPer;
  }
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

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function Dashboard() {
  /* State */
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState("Mississauga");
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Threshold slider (°C)
  const [threshold, setThreshold] = useState(12);

  // StatCan retail
  const [retailData, setRetailData] = useState<RetailDataPoint[]>([]);
  const [retailLoading, setRetailLoading] = useState(true);
  const [retailError, setRetailError] = useState(false);

  // 511 traffic
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState(false);

  const pitchRef = useRef<HTMLTextAreaElement>(null);

  /* ── Fetch cities ─────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch(apiUrl("/api/cities"))
      .then((r) => r.json())
      .then((data) => {
        setCities(data);
      })
      .catch(() => setError("Failed to load cities."));
  }, []);

  /* ── Fetch weather ────────────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setError("");
    setWeather(null);
    setPitch("");
    fetch(apiUrl(`/api/weather?city=${encodeURIComponent(selectedCity)}`))
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
  }, [selectedCity]);

  /* ── Fetch StatCan retail index ───────────────────────────────────────── */
  useEffect(() => {
    setRetailLoading(true);
    setRetailError(false);
    fetch(apiUrl("/api/statcan/ontario-retail"))
      .then((r) => {
        if (!r.ok) throw new Error("StatCan error");
        return r.json();
      })
      .then((json: { data: Array<{ period: string; value: number }>; trend: string; latestValue: number; changePercent: number }) => {
        const obs: RetailDataPoint[] = (json?.data ?? []).map((pt) => ({
          refPer: pt.period,
          value: pt.value,
        }));
        setRetailData(obs);
        setRetailLoading(false);
      })
      .catch(() => {
        setRetailError(true);
        setRetailLoading(false);
      });
  }, []);

  /* ── Fetch 511 traffic ────────────────────────────────────────────────── */
  useEffect(() => {
    setTrafficLoading(true);
    setTrafficError(false);
    fetch(apiUrl("/api/traffic/gta"))
      .then((r) => {
        if (!r.ok) throw new Error("511 error");
        return r.json();
      })
      .then((data: { incidentCount: number; disruptionLevel: string; topEvents: Array<{ description: string; county: string; road: string }> }) => {
        // Convert proxy response to TrafficEvent array format
        const events: TrafficEvent[] = (data.topEvents ?? []).map(e => ({
          Description: e.description,
          County: e.county,
          EventType: "Incident",
        }));
        setTrafficEvents(events);
        setTrafficLoading(false);
      })
      .catch(() => {
        setTrafficError(true);
        setTrafficLoading(false);
      });
  }, []);

  /* ── Client-side trigger re-evaluation ───────────────────────────────── */
  const clientTrigger = useMemo(() => {
    if (!weather) return null;
    // days 2-4 (indices 1-3, 0-based)
    const window = weather.forecast.slice(1, 4);
    if (!window.length) return null;
    const avgTemp =
      window.reduce((s, d) => s + d.tempAvg, 0) / window.length;
    const wetDays = window.filter((d) => d.precipitationMm > 0).length;
    const triggered = avgTemp < threshold && wetDays > 0;
    return { triggered, avgTemp, wetDays, threshold };
  }, [weather, threshold]);

  /* ── KPI values ───────────────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    if (!weather || !clientTrigger)
      return { triggered: false, avgTemp: 0, wetDays: 0, threshold, forecastDays: 0 };
    return {
      triggered: clientTrigger.triggered,
      avgTemp: clientTrigger.avgTemp,
      wetDays: clientTrigger.wetDays,
      threshold,
      forecastDays: weather.forecast.length,
    };
  }, [weather, clientTrigger, threshold]);

  /* ── Disruption level ─────────────────────────────────────────────────── */
  const disruptionLevel: DisruptionLevel = useMemo(
    () => getDisruptionLevel(trafficEvents.length),
    [trafficEvents]
  );

  /* ── Active demand band ───────────────────────────────────────────────── */
  const activeBandIdx = useMemo(() => {
    if (!clientTrigger) return -1;
    return getActiveBand(clientTrigger.avgTemp);
  }, [clientTrigger]);

  /* ── Slider threshold marker position (for demand chart) ─────────────── */
  const maxUplift = 67;

  /* ── Generate pitch ───────────────────────────────────────────────────── */
  async function generatePitch() {
    if (!weather) return;
    setPitchLoading(true);
    setPitch("");
    setError("");
    try {
      const payload = {
        city: selectedCity,
        weatherData: {
          ...weather,
          customThreshold: threshold,
          clientTrigger,
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
    if (!clientTrigger) return day.inTriggerWindow;
    // A day is "in trigger window" if it's in days 2-4 and avgTemp < threshold
    const idx = weather?.forecast.indexOf(day) ?? -1;
    return idx >= 1 && idx <= 3 && clientTrigger.triggered;
  }

  const disruptionColor: Record<DisruptionLevel, string> = {
    Low: "#34d399",
    Moderate: "#fbbf24",
    High: "#f87171",
  };

  /* ── Retail trend ─────────────────────────────────────────────────────── */
  const retailTrend = useMemo(() => {
    if (retailData.length < 2) return null;
    const sorted = [...retailData].sort(
      (a, b) => new Date(a.refPer).getTime() - new Date(b.refPer).getTime()
    );
    const prev = sorted[sorted.length - 2].value;
    const curr = sorted[sorted.length - 1].value;
    return curr >= prev ? "up" : "down";
  }, [retailData]);

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
        .forecast-strip::-webkit-scrollbar {
          height: 4px;
        }
        .forecast-strip::-webkit-scrollbar-track {
          background: #0f172a;
          border-radius: 2px;
        }
        .forecast-strip::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 2px;
        }
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
        .city-select {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 14px;
          padding: 8px 14px;
          cursor: pointer;
          outline: none;
        }
        .city-select:focus { border-color: #3b82f6; }
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
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "transparent",
          color: "#f1f5f9",
          fontFamily:
            "'Inter', 'DM Sans', system-ui, -apple-system, sans-serif",
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
              Weather-driven demand signals · Ontario retail · GTA traffic
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label
              htmlFor="city-select"
              style={{ fontSize: "13px", color: "#94a3b8" }}
            >
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

        {/* ── Threshold Slider ─────────────────────────────────────────── */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <span className="section-title" style={{ margin: 0 }}>
              Trigger Threshold
            </span>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#3b82f6",
              }}
            >
              {threshold}°C
            </span>
          </div>
          <input
            type="range"
            className="threshold-slider"
            min={0}
            max={30}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            aria-label="Trigger threshold in degrees Celsius"
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
            <span>0°C (freezing)</span>
            <span>15°C (cool)</span>
            <span>30°C (warm)</span>
          </div>
          {clientTrigger && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              Window avg:{" "}
              <strong style={{ color: "#f1f5f9" }}>
                {clientTrigger.avgTemp.toFixed(1)}°C
              </strong>{" "}
              · Wet days:{" "}
              <strong style={{ color: "#f1f5f9" }}>
                {clientTrigger.wetDays}
              </strong>{" "}
              ·{" "}
              {clientTrigger.triggered ? (
                <span style={{ color: "#22d3ee", fontWeight: 600 }}>
                  Trigger ACTIVE
                </span>
              ) : (
                <span style={{ color: "#64748b" }}>Not triggered</span>
              )}
            </p>
          )}
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kpi-card">
                <Skeleton w="60%" h={14} />
                <Skeleton w="40%" h={28} />
              </div>
            ))
          ) : (
            <>
              <div className="kpi-card">
                <span className="kpi-label">Trigger Status</span>
                <span
                  className="kpi-value"
                  style={{ color: kpi.triggered ? "#22d3ee" : "#64748b" }}
                >
                  {kpi.triggered ? "Active" : "Inactive"}
                </span>
                <span
                  className={`badge ${
                    kpi.triggered ? "badge-triggered" : "badge-not-triggered"
                  }`}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  {kpi.triggered ? "Promo ON" : "No promo"}
                </span>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Window Avg Temp</span>
                <span
                  className="kpi-value"
                  style={{
                    color:
                      kpi.avgTemp < threshold ? "#22d3ee" : "#f87171",
                  }}
                >
                  {kpi.avgTemp.toFixed(1)}°C
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Threshold: {threshold}°C
                </span>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Wet Days (window)</span>
                <span
                  className="kpi-value"
                  style={{ color: kpi.wetDays > 0 ? "#34d399" : "#64748b" }}
                >
                  {kpi.wetDays}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  of {Math.min(3, kpi.forecastDays)} days
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
          <p className="section-title">Demand Sensitivity</p>
          <p
            style={{
              margin: "-8px 0 14px",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Estimated soup demand uplift vs. baseline (Dunnhumby)
          </p>
          <div className="demand-bar-wrap">
            {DEMAND_BANDS.map((band, i) => {
              const isActive = i === activeBandIdx;
              const isPositive = band.uplift > 0;
              const isZero = band.uplift === 0;
              const isNegative = band.uplift < 0;
              // bar width: map uplift to % of track
              // range: -15 to 67 → normalize to 0-100%
              const pct =
                isNegative
                  ? (Math.abs(band.uplift) / 15) * 30
                  : isZero
                  ? 2
                  : (band.uplift / maxUplift) * 100;

              return (
                <div
                  key={band.label}
                  className={`demand-row ${isActive ? "demand-bar-active" : ""}`}
                  style={{
                    opacity: isActive ? 1 : 0.65,
                  }}
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
                    {/* Threshold marker overlay */}
                    {isActive && (() => {
                      // show a vertical line at the threshold's relative position within this band
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
                          title={`Threshold: ${threshold}°C`}
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
                    {band.uplift > 0 ? "+" : ""}
                    {band.uplift}%
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
            Yellow marker = threshold ({threshold}°C) within current band
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
          {/* StatCan Retail */}
          <div className="dash-card">
            <p className="section-title">Ontario Retail Index</p>
            <p
              style={{
                margin: "-8px 0 14px",
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Monthly grocery & food/bev sales · Statistics Canada v32551248
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
            ) : (
              <>
                {(() => {
                  const sorted = [...retailData].sort(
                    (a, b) =>
                      new Date(a.refPer).getTime() -
                      new Date(b.refPer).getTime()
                  );
                  return sorted.map((pt, i) => {
                    const isLatest = i === sorted.length - 1;
                    const prev = i > 0 ? sorted[i - 1].value : null;
                    const diff =
                      prev !== null ? pt.value - prev : null;
                    return (
                      <div key={pt.refPer} className="retail-row">
                        <span
                          style={{
                            fontSize: "14px",
                            color: isLatest ? "#f1f5f9" : "#94a3b8",
                            fontWeight: isLatest ? 600 : 400,
                          }}
                        >
                          {formatStatCanMonth(pt.refPer)}
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
                            ${(pt.value / 1000).toFixed(0)}M
                          </span>
                          {isLatest && retailTrend && (
                            <span
                              style={{
                                fontSize: "18px",
                                color:
                                  retailTrend === "up"
                                    ? "#34d399"
                                    : "#f87171",
                              }}
                            >
                              {retailTrend === "up" ? "↑" : "↓"}
                            </span>
                          )}
                          {diff !== null && (
                            <span
                              style={{
                                fontSize: "12px",
                                color:
                                  diff >= 0 ? "#34d399" : "#f87171",
                              }}
                            >
                              {diff >= 0 ? "+" : ""}
                              {(diff / 1000).toFixed(0)}M
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
