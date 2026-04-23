import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { apiUrl } from "../api";
import RetailPulse from "./RetailPulse";

type DataPoint = { refPer: string; value: number };

type CuratedSnap = {
  id: string;
  titleEn: string;
  frequencyDesc: string;
  tableUrl: string;
  latestPoints: DataPoint[];
  lastFetchedAt: string;
};

type StatCanSummary = {
  attribution: string;
  catalogBrowseUrl: string;
  wdsNote: string;
  generatedAt: string;
  liteListSyncedAt: string | null;
  catalogEntryCount: number;
  catalogSample: {
    productId: number;
    cansimId: string | null;
    titleEn: string;
    frequencyDesc: string;
    releaseTime?: string;
    tableUrl: string;
  }[];
  catalogAutoPreviews: {
    productId: number;
    titleEn: string;
    frequencyDesc: string;
    tableUrl: string;
    coordinate: string;
    previewPoints: DataPoint[];
    discoveryNote?: string;
  }[];
  curated: CuratedSnap[];
};

export default function SentimentMacro() {
  const [data, setData] = useState<StatCanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError("");
    try {
      const q = force ? "?forceSeries=1&forceCatalog=1&forceAuto=1" : "";
      const res = await fetch(apiUrl(`/api/statcan/summary${q}`));
      const json = (await res.json()) as StatCanSummary | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "StatCan summary failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Sentiment & macro</p>
          <h2>Public signals</h2>
          <p className="sidebar-copy" style={{ maxWidth: 920 }}>
            Combines <strong>Statistics Canada</strong> agriculture & food tables (subject 32 / 3205, same universe as the
            official browse listing) with the <strong>Reddit Canada retail pulse</strong>. StatCan uses the official{" "}
            <span className="mono">WDS</span> API; first sync may take a moment while the cube inventory downloads.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void load(true)}>
          {loading ? "Refreshing…" : "Hard refresh (StatCan)"}
        </button>
      </header>

      {error ? <div className="callout error">{error}</div> : null}

      {data ? (
        <p className="mono disclaimer" style={{ marginBottom: 16 }}>
          {data.attribution} Source listing:{" "}
          <a href={data.catalogBrowseUrl} target="_blank" rel="noreferrer">
            {data.catalogBrowseUrl}
          </a>
          . {data.wdsNote}
        </p>
      ) : null}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Statistics Canada — curated series</h3>
        {loading && !data ? <div className="skeleton pitch-skeleton" /> : null}
        {data ? (
          <p className="mono meta-line">
            Catalog rows (food / grocery / eggs filter): {data.catalogEntryCount} · lite list synced:{" "}
            {data.liteListSyncedAt ?? "—"} · generated {data.generatedAt}
          </p>
        ) : null}
        {data ? (
          <div className="kpi-grid" style={{ marginTop: 12 }}>
            {data.curated.map((c) => {
              const last = c.latestPoints[c.latestPoints.length - 1];
              const prev = c.latestPoints[c.latestPoints.length - 2];
              const delta =
                last && prev && Number.isFinite(last.value) && Number.isFinite(prev.value)
                  ? last.value - prev.value
                  : null;
              return (
                <div key={c.id} className="card kpi-card">
                  <span>{c.titleEn}</span>
                  <strong>{last ? `${last.value}` : "—"}</strong>
                  <p className="sidebar-copy" style={{ margin: "6px 0 0", fontSize: 12 }}>
                    {last?.refPer ?? "—"} · {c.frequencyDesc}
                    {delta !== null && Number.isFinite(delta) ? (
                      <span className="mono"> · Δ vs prior {delta > 0 ? "+" : ""}{delta.toFixed(2)}</span>
                    ) : null}
                  </p>
                  <a href={c.tableUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                    Open table on StatCan
                  </a>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {data?.catalogAutoPreviews?.length ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Catalog — auto-discovered coordinates</h3>
          <p className="sidebar-copy" style={{ marginBottom: 10 }}>
            For the first <span className="mono">{data.catalogAutoPreviews.length}</span> non-curated tables, the server
            calls <span className="mono">getCubeMetadata</span>, picks a Canada / &quot;total&quot; style path, then falls back to
            &quot;first member per dimension&quot; if needed. Results are cached (see env{" "}
            <span className="mono">STATCAN_AUTO_PREVIEW_CACHE_HOURS</span>, <span className="mono">STATCAN_AUTO_DISCOVER_MAX</span>
            ).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Coordinate</th>
                  <th>Latest values</th>
                  <th>Table</th>
                </tr>
              </thead>
              <tbody>
                {data.catalogAutoPreviews.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      {row.titleEn}
                      {row.discoveryNote ? (
                        <div className="mono" style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                          {row.discoveryNote}
                        </div>
                      ) : null}
                    </td>
                    <td className="mono">{row.coordinate}</td>
                    <td className="mono">
                      {row.previewPoints
                        .map((p) => `${p.refPer?.slice(0, 10)}=${p.value}`)
                        .join(" · ")}
                    </td>
                    <td>
                      <a href={row.tableUrl} target="_blank" rel="noreferrer">
                        {row.productId}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Catalog sample (linked tables)</h3>
          <p className="sidebar-copy" style={{ marginBottom: 10 }}>
            Titles are filtered for <strong>food</strong>, <strong>grocery</strong>, <strong>eggs</strong>, retail/CPI
            language, and subject prefix <span className="mono">32</span>. Refresh cadence follows each table&apos;s
            WDS frequency (weekly / monthly / annual) in the server cache.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Freq</th>
                  <th>Released</th>
                  <th>Table</th>
                </tr>
              </thead>
              <tbody>
                {data.catalogSample.map((row) => (
                  <tr key={row.productId}>
                    <td>{row.titleEn}</td>
                    <td className="mono">{row.frequencyDesc}</td>
                    <td className="mono">{row.releaseTime?.slice(0, 10) ?? "—"}</td>
                    <td>
                      <a href={row.tableUrl} target="_blank" rel="noreferrer">
                        {row.productId}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Reddit — Canada retail pulse</h3>
        <p className="sidebar-copy" style={{ marginBottom: 12 }}>
          Same module as <Link href="/reddit-pulse">/reddit-pulse</Link> for deep linking; embedded here for the
          Sentiment workspace.
        </p>
      </div>
      <RetailPulse />
    </section>
  );
}
