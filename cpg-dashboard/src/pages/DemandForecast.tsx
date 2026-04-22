import { useEffect, useState, type CSSProperties } from "react";
import { apiUrl } from "../api";
import { useWeatherContext } from "./WeatherContext";
import LastUpdated from "./LastUpdated";
import { DEMAND_CATEGORY_LIST, isDemandCategory } from "../constants/demandCategories";

type ForecastWeek = {
  weekStart: string;
  index: number;
  indexLow: number;
  indexHigh: number;
  drivers: string[];
};

type ForecastPayload = {
  city: string;
  category: string;
  weeks: ForecastWeek[];
  baselineWeeklyMillions: number;
  methodology: string;
  weatherWindowDates: string[];
  coldTriggered: boolean;
  hotTriggered: boolean;
};

const S: Record<string, CSSProperties> = {
  page: { padding: "32px 28px", maxWidth: 1100 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#22d3ee", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 12, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "22px 24px", marginBottom: 20 },
  body: { fontSize: 15, color: "#94a3b8", lineHeight: 1.7, marginBottom: 16 },
};

export default function DemandForecast() {
  const { selectedCity, threshold, hotThreshold, demandCategory, setDemandCategory } = useWeatherContext();
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const q = new URLSearchParams({
      city: selectedCity,
      threshold: String(threshold),
      hotThreshold: String(hotThreshold),
      demandCategory,
    });
    fetch(apiUrl(`/api/forecast/demand?${q}`))
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error ?? r.statusText)))))
      .then((j: ForecastPayload) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load forecast");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demandCategory, hotThreshold, selectedCity, threshold]);

  return (
    <div style={S.page} className="page">
      <p style={S.eyebrow}>Predictive demand</p>
      <h2 style={S.h2}>Demand forecast index</h2>
      <p style={S.body}>
        Six-week <strong style={{ color: "#e2e8f0" }}>relative demand index</strong> (100 ≈ implied baseline weekly
        sales from StatCan Ontario NAICS monthly series for your food category). Forward weeks blend smooth
        seasonality, approximate Canadian holiday retail windows, and your current Open-Meteo activation flags
        (cold+wet vs hot+dry). This is an <strong style={{ color: "#e2e8f0" }}>MVP heuristic</strong>, not a
        production ML forecaster or inventory optimizer.
      </p>

      <div style={S.card}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>
          Food category (StatCan NAICS mapping)
        </label>
        <select
          className="cat-select"
          value={demandCategory}
          onChange={(e) => {
            const v = e.target.value;
            if (isDemandCategory(v)) setDemandCategory(v);
          }}
          style={{ maxWidth: 320, padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0" }}
        >
          {DEMAND_CATEGORY_LIST.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Loading forecast…</p>}
      {error && (
        <div style={{ ...S.card, borderColor: "#7f1d1d", color: "#fca5a5" }}>
          {error}
          <p style={{ marginTop: 10, fontSize: 14, color: "#94a3b8" }}>
            StatCan or weather must be reachable from the API. Retry after cache warm or check server logs.
          </p>
        </div>
      )}

      {data && !loading && (
        <>
          <div style={S.card}>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#cbd5e1" }}>
              <strong>{data.city}</strong> · category <strong>{data.category}</strong> · baseline implied weekly{" "}
              <strong>{data.baselineWeeklyMillions} M$</strong> CAD (from monthly NAICS mix).
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
              Cold lane: {data.coldTriggered ? "on" : "off"} · Hot lane: {data.hotTriggered ? "on" : "off"} · Weather
              window dates: {data.weatherWindowDates?.join(", ") || "—"}
            </p>
            <LastUpdated />
            <p style={{ marginTop: 14, fontSize: 13, color: "#94a3b8", lineHeight: 1.65 }}>{data.methodology}</p>
          </div>

          <div style={S.card}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>Weekly horizon</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {data.weeks.map((w) => (
                <div
                  key={w.weekStart}
                  style={{
                    border: "1px solid #334155",
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: "#0f172a",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0" }}>Week of {w.weekStart}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#22d3ee" }}>
                      Index {w.index} <span style={{ color: "#64748b" }}>({w.indexLow}–{w.indexHigh})</span>
                    </span>
                  </div>
                  <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: "#1e293b", position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: `${Math.min(100, Math.max(0, ((w.indexLow - 85) / 33) * 100))}%`,
                        width: `${Math.min(100, Math.max(0, ((w.indexHigh - w.indexLow) / 33) * 100))}%`,
                        top: 0,
                        bottom: 0,
                        borderRadius: 4,
                        background: "linear-gradient(90deg,#0ea5e9,#22d3ee)",
                      }}
                    />
                  </div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    {w.drivers.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
