import { apiUrl } from "../api";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import LastUpdated from "./LastUpdated";
import { useWeatherContext } from "./WeatherContext";
import { DEMAND_CATEGORY_LIST, isDemandCategory } from "../constants/demandCategories";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { useUiDensity } from "../components/UiDensity";

type City = { name: string; lat: number; lon: number };

type BasketInsights = {
  city: string;
  season: string;
  scenario: string;
  scenarioLabel: string;
  anchor: { key: string; label: string; rationale: string };
  thresholdUsed: number;
  hotThresholdUsed?: number;
  trigger: {
    triggered: boolean;
    coldTriggered?: boolean;
    hotTriggered?: boolean;
    avgTemp: number;
    wetDays: number;
    threshold: number;
    hotThreshold?: number;
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
  /** Present when API scored a specific dashboard demand category. */
  demandCategory?: string;
};

export default function BasketAnalysis() {
  const { selectedCity, setSelectedCity, threshold, hotThreshold, demandCategory, setDemandCategory } =
    useWeatherContext();
  const { density } = useUiDensity();
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
        threshold: String(threshold),
        hotThreshold: String(hotThreshold),
        category: demandCategory,
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
  }, [selectedCity, threshold, hotThreshold, demandCategory]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const companionTitle = data?.demandCategory
    ? `${data.demandCategory} basket companions`
    : data?.anchor.key === "soup"
      ? "Soup companions"
      : `${data?.anchor.label ?? "Anchor"} companions`;

  return (
    <section className="page">
      <PageHeader
        eyebrow="Basket Analysis"
        title={data ? `${data.anchor.label}` : "Basket insights"}
        description={
          data
            ? `${data.city} · ${data.season} · ${data.scenarioLabel} · 3-day avg ${data.trigger.avgTemp}°C (cold below ${data.thresholdUsed}°C, hot above ${data.hotThresholdUsed ?? data.trigger.hotThreshold ?? "—"}°C, wet days ${data.trigger.wetDays}${data.trigger.coldTriggered ? " · cold lane" : ""}${data.trigger.hotTriggered ? " · hot lane" : ""})`
            : "Companion products, cross-dept pairs, and activation framing for the selected demand category."
        }
        right={
          <LastUpdated
            key={refreshedAt ?? "pending"}
            fetchedAt={refreshedAt ?? undefined}
            label={data?.meta?.last_updated ? "Unified signal compiled" : "Analysis refreshed"}
          />
        }
      />

      <SectionCard
        title="Controls"
        subtitle="City + demand category (syncs with Dashboard)"
        storageKey="sec:basket:controls"
        defaultCollapsed={density === "executive"}
        right={
          <button type="button" className="ghost-button" onClick={() => void loadInsights()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted">City</span>
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ minWidth: 160 }}>
              {(cities.length ? cities : [{ name: selectedCity, lat: 0, lon: 0 }]).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted">Food category</span>
            <select
              value={demandCategory}
              onChange={(e) => {
                const v = e.target.value;
                if (isDemandCategory(v)) setDemandCategory(v);
              }}
              style={{ minWidth: 180 }}
            >
              {DEMAND_CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <span className="mono muted" style={{ fontSize: 13 }}>
            Cold threshold {threshold}°C · Hot threshold {hotThreshold}°C (adjust on Dashboard)
          </span>
        </div>
      </SectionCard>

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
            <SectionCard
              title={companionTitle}
              subtitle="% of anchor baskets"
              storageKey="sec:basket:companions"
              defaultCollapsed={density === "executive"}
            >
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
            </SectionCard>

            <SectionCard
              title="Top cross-department pairs"
              subtitle="Lift from unified signal"
              storageKey="sec:basket:pairs"
              defaultCollapsed={density === "executive"}
            >
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
            </SectionCard>
          </div>

          <SectionCard title="Insight callout" subtitle="One-slide narrative" storageKey="sec:basket:callout">
            <p style={{ margin: 0, lineHeight: 1.7 }}>{data.callout}</p>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              Weather trigger (next 3 forecast days vs threshold) matches the Dashboard; category selection is shared
              with Demand Sensitivity. Basket companions use live soup co-purchase rows for{" "}
              <strong>Canned Soup</strong> when available, and curated estimates for other categories; pairs are
              filtered from <code>output/unified_signal.json</code>.
            </p>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              For <strong>StatCan food tables</strong> plus <strong>Canada grocery / retail</strong> discussion on Reddit
              (public search, no OAuth), open{" "}
              <Link href="/signals">Sentiment &amp; macro</Link> or <Link href="/reddit-pulse">Reddit pulse</Link>
              .
            </p>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}
