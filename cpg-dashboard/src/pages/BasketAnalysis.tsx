import { apiUrl } from "../api";
import { useCallback, useEffect, useState } from "react";
import LastUpdated from "./LastUpdated";
import { useWeatherContext } from "./WeatherContext";

type City = { name: string; lat: number; lon: number };

type BasketInsights = {
  city: string;
  season: string;
  scenario: string;
  scenarioLabel: string;
  anchor: { key: string; label: string; rationale: string };
  thresholdUsed: number;
  trigger: {
    triggered: boolean;
    avgTemp: number;
    wetDays: number;
    threshold: number;
    windowDates: string[];
  };
  companions: Array<{ product: string; pct: number }>;
  pairs: Array<{ pair: string; lift: string; support: string }>;
  kpis: {
    totalBaskets: string;
    households: string;
    dataPeriod: string;
    anchorBasketRate: string;
    anchorRateLabel: string;
  };
  callout: string;
  meta: { last_updated?: string };
};

export default function BasketAnalysis() {
  const { selectedCity, setSelectedCity, threshold } = useWeatherContext();
  const [cities, setCities] = useState<City[]>([]);
  const [data, setData] = useState<BasketInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/cities"))
      .then((r) => r.json())
      .then((rows: City[]) => {
        if (!cancelled && Array.isArray(rows)) setCities(rows);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        city: selectedCity,
        threshold: String(threshold)
      });
      const res = await fetch(apiUrl(`/api/basket-insights?${q.toString()}`));
      const body = (await res.json()) as BasketInsights & { error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setData(body);
      setRefreshedAt(Date.now());
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load basket insights");
    } finally {
      setLoading(false);
    }
  }, [selectedCity, threshold]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const companionTitle =
    data?.anchor.key === "soup"
      ? "Soup companions"
      : `${data?.anchor.label ?? "Anchor"} companions`;

  return (
    <section className="page">
      <header
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div>
          <p className="eyebrow">Basket Analysis</p>
          <h2>{data ? `${data.anchor.label}` : "Basket insights"}</h2>
          {data && (
            <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
              <strong>{data.city}</strong> · calendar <strong>{data.season}</strong> ·{" "}
              <strong>{data.scenarioLabel}</strong> · 3-day avg{" "}
              <strong>{data.trigger.avgTemp}°C</strong> (threshold {data.thresholdUsed}°C, wet days{" "}
              {data.trigger.wetDays})
            </p>
          )}
        </div>
        <LastUpdated
          key={refreshedAt ?? "pending"}
          fetchedAt={refreshedAt ?? undefined}
          label={data?.meta?.last_updated ? "Unified signal compiled" : "Analysis refreshed"}
        />
      </header>

      <div className="card" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted">City (syncs with Dashboard)</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{ minWidth: 160 }}
          >
            {(cities.length ? cities : [{ name: selectedCity, lat: 0, lon: 0 }]).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <span className="mono muted" style={{ fontSize: 13 }}>
          Trigger threshold {threshold}°C — change it on the Dashboard to re-score this page.
        </span>
        <button type="button" className="ghost-button" onClick={() => void loadInsights()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="card callout" style={{ borderColor: "#b45309", marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {loading && !data ? (
        <p className="muted">Loading weather-aligned basket view…</p>
      ) : data ? (
        <>
          <div className="kpi-grid">
            <div className="card kpi-card">
              <span>Total baskets (signal)</span>
              <strong>{data.kpis.totalBaskets}</strong>
            </div>
            <div className="card kpi-card">
              <span>Households</span>
              <strong>{data.kpis.households}</strong>
            </div>
            <div className="card kpi-card">
              <span>Data period</span>
              <strong>{data.kpis.dataPeriod}</strong>
            </div>
            <div className="card kpi-card">
              <span>{data.kpis.anchorRateLabel}</span>
              <strong>{data.kpis.anchorBasketRate}</strong>
            </div>
          </div>

          <div className="two-column">
            <div className="card">
              <div className="section-title-row">
                <h3>{companionTitle}</h3>
                <span className="mono">% of anchor baskets</span>
              </div>
              <div className="bar-list">
                {data.companions.map(({ product, pct }) => (
                  <div key={product} className="bar-row">
                    <div className="bar-meta">
                      <span>{product}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title-row">
                <h3>Top cross-department pairs</h3>
                <span className="mono">Lift from unified signal</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Lift</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.map((row) => (
                    <tr key={row.pair}>
                      <td>{row.pair}</td>
                      <td>{row.lift}</td>
                      <td>{row.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card callout">
            <h3>Insight callout</h3>
            <p style={{ marginBottom: 0 }}>{data.callout}</p>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              Weather trigger (next 3 forecast days vs threshold) matches the Dashboard; basket tables come from{" "}
              <code>output/unified_signal.json</code> with scenario-specific filtering.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
