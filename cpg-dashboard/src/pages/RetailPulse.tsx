import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../api";

type RetailPulseResponse = {
  generatedAt: string;
  source: string;
  oauthRequired: boolean;
  templates: { id: string; label: string; q: string; fetched: number; ok: boolean; error?: string }[];
  posts: {
    id: string;
    title: string;
    subreddit: string;
    permalink: string;
    snippet: string;
    matchedTemplates: string[];
    relevanceScore: number;
  }[];
  topTerms: { term: string; count: number }[];
  search: {
    mode: string;
    subredditCount: number;
    chunkCount: number;
    chunkSize: number;
    samplePath: string;
  };
  filter: {
    rawCandidates: number;
    kept: number;
    droppedSpam: number;
    droppedBlocklistSub: number;
    droppedLowRelevance: number;
    minRelevanceRaw: number;
  };
  disclaimer: string;
};

export default function RetailPulse() {
  const [pulse, setPulse] = useState<RetailPulseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setError("");
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(apiUrl(`/api/reddit-canada-retail-pulse${q}`));
      const json = (await res.json()) as RetailPulseResponse | { error: string };
      if (!res.ok || "error" in json) throw new Error("error" in json ? json.error : "Pulse failed");
      setPulse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPulse(null);
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
          <p className="eyebrow">Public signal</p>
          <h2>Canada retail & grocery pulse</h2>
          <p className="sidebar-copy" style={{ maxWidth: 900 }}>
            Reddit <strong>search.json</strong> only — <strong>no OAuth</strong>. Ten Canada-focused templates, then a{" "}
            <strong>grocery relevance score</strong> (plus spam + subreddit filters) so unrelated “Canada + price” noise
            drops out. Searches run inside a <strong>Canada geo subreddit union</strong> with{" "}
            <span className="mono">restrict_sr=on</span> (chunked <span className="mono">r/a+b+c/search.json</span>).{" "}
            <span className="mono">Matched</span> is which query template hit the post. Cache ~12 minutes. Env:{" "}
            <span className="mono">REDDIT_USER_AGENT</span>, <span className="mono">REDDIT_CANADA_GEO_SUBS</span> (comma
            extra subs).
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void load(true)}>
          {loading ? "Refreshing…" : "Refresh pulse"}
        </button>
      </header>

      {error ? <div className="callout error">{error}</div> : null}
      {pulse?.disclaimer ? <p className="mono disclaimer">{pulse.disclaimer}</p> : null}
      {pulse ? (
        <p className="mono meta-line">
          Generated {pulse.generatedAt} · geo subs {pulse.search.subredditCount} in {pulse.search.chunkCount} unions
          (~{pulse.search.chunkSize}/union), e.g. <strong>{pulse.search.samplePath}</strong> · templates{" "}
          {pulse.templates.filter((t) => t.ok).length}/{pulse.templates.length} ok · kept {pulse.posts.length} /{" "}
          {pulse.filter.rawCandidates} (spam −{pulse.filter.droppedSpam}, blocklist −{pulse.filter.droppedBlocklistSub},
          score −{pulse.filter.droppedLowRelevance})
        </p>
      ) : null}
      {loading && !pulse ? <div className="skeleton pitch-skeleton" /> : null}

      {pulse ? (
        <div className="two-column" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Query templates</h3>
            <ul className="sidebar-copy template-list">
              {pulse.templates.map((t) => (
                <li key={t.id}>
                  <strong>{t.label}</strong> — {t.fetched} hits{t.ok ? "" : ` (${t.error ?? "error"})`}
                  <div className="mono q-preview">{t.q}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Top terms</h3>
            <p className="mono term-cloud">
              {pulse.topTerms.slice(0, 28).map((x) => (
                <span key={x.term} className="term-chip">
                  {x.term} <small>({x.count})</small>
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : null}

      {pulse ? (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Recent posts (deduped + filtered)</h3>
          {pulse.posts.length === 0 ? (
            <p className="sidebar-copy">Nothing passed the grocery filter for this window — try Refresh, or loosen rules in{" "}
              <span className="mono">redditCanadaRetailPulse.ts</span>.</p>
          ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sub</th>
                <th>Title</th>
                <th>Score</th>
                <th>Matched queries</th>
              </tr>
            </thead>
            <tbody>
              {pulse.posts.slice(0, 40).map((p) => (
                <tr key={p.id}>
                  <td className="mono">r/{p.subreddit}</td>
                  <td>
                    <a href={p.permalink} target="_blank" rel="noreferrer">
                      {p.title}
                    </a>
                    <div className="sidebar-copy snippet">{p.snippet}</div>
                  </td>
                  <td className="mono">{p.relevanceScore}</td>
                  <td className="mono matched-col">{p.matchedTemplates.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
