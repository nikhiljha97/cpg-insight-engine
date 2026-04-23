import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useSignalsAddon } from "../context/SignalsAddonContext";

const HIDE_PATHS = new Set(["/", "/signals", "/reddit-pulse"]);

/**
 * Shared StatCan + Reddit pulse strip shown before page-specific analysis (Insight Engine add-on layer).
 */
export default function SignalsAddonBanner() {
  const [location] = useHashLocation();
  const { statcan, pulse, loading, error, refresh } = useSignalsAddon();

  if (HIDE_PATHS.has(location)) return null;

  const topCurated = statcan?.curated?.[0];
  const lastPt = topCurated?.latestPoints?.slice(-1)[0];
  const sa = pulse?.sentimentAnalysis;

  return (
    <section className="card" style={{ marginBottom: 20, borderColor: "rgba(56, 189, 248, 0.35)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Add-on layer · StatCan + social pulse
          </p>
          <p className="sidebar-copy" style={{ margin: 0, maxWidth: 920 }}>
            Same sources as <Link href="/signals">Sentiment &amp; macro</Link> — loaded once for context on every
            analysis page. Use it as a macro / tone check before interpreting category or basket metrics below.
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh layer"}
        </button>
      </div>

      {error ? (
        <p className="muted" style={{ marginTop: 12, color: "#fca5a5" }}>
          {error}
        </p>
      ) : null}

      {loading && !statcan && !pulse ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Loading StatCan summary and Reddit pulse…
        </p>
      ) : (
        <div
          className="kpi-grid"
          style={{
            marginTop: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div className="card kpi-card">
            <span>StatCan catalog (food / ag)</span>
            <strong>{statcan?.catalogEntryCount ?? "—"}</strong>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>
              Synced {statcan?.liteListSyncedAt?.slice(0, 10) ?? "—"}
            </div>
          </div>
          <div className="card kpi-card">
            <span>Curated spotlight</span>
            <strong style={{ fontSize: 14, lineHeight: 1.3 }}>
              {topCurated ? topCurated.titleEn.slice(0, 72) + (topCurated.titleEn.length > 72 ? "…" : "") : "—"}
            </strong>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>
              {lastPt ? `${lastPt.refPer}: ${lastPt.value}` : "—"}
            </div>
          </div>
          <div className="card kpi-card">
            <span>Reddit pulse · posts kept</span>
            <strong>
              {pulse?.filter.kept ?? "—"} / {pulse?.filter.rawCandidates ?? "—"}
            </strong>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>
              Top term: {pulse?.topTerms?.[0] ? `${pulse.topTerms[0].term} (${pulse.topTerms[0].count})` : "—"}
            </div>
          </div>
          <div className="card kpi-card">
            <span>Pulse sentiment index (ML-style)</span>
            <strong>{sa && sa.sampleSize ? `${sa.index0to100} / 100` : "—"}</strong>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>
              {sa?.label ?? "—"} · n={sa?.sampleSize ?? 0}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
