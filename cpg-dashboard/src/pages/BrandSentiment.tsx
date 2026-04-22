import { useEffect, useState, type CSSProperties } from "react";
import { apiUrl } from "../api";

type RedditPost = {
  subreddit: string;
  title: string;
  link: string;
  published?: string;
  sentiment: number;
  groceryMatch: boolean;
};

type SentimentPayload = {
  fetchedAt: string;
  aggregateScore: number;
  matchedCount: number;
  posts: RedditPost[];
  usedFallback: boolean;
  subreddits: string[];
  methodology: string;
  error?: string;
};

const S: Record<string, CSSProperties> = {
  page: { padding: "32px 28px", maxWidth: 1100 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 12, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "22px 24px", marginBottom: 20 },
};

function scoreColor(score: number, hasSignal: boolean): string {
  if (!hasSignal) return "#94a3b8";
  if (score > 0.12) return "#4ade80";
  if (score < -0.12) return "#f87171";
  return "#fbbf24";
}

export default function BrandSentiment() {
  const [data, setData] = useState<SentimentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl("/api/sentiment/reddit-grocery"))
      .then((r) => r.json() as Promise<SentimentPayload>)
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const score = data?.aggregateScore ?? 0;
  const hasGrocerySignal = !!data && data.matchedCount > 0 && !data.usedFallback;

  return (
    <div style={S.page} className="page">
      <p style={S.eyebrow}>Social listening · prototype</p>
      <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>Brand & grocery sentiment (Reddit)</h2>
      <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
        Snapshot from Reddit’s <strong style={{ color: "#e2e8f0" }}>public JSON “hot” listings</strong> (no API key)
        across Canada-oriented subs. Titles are tagged with a <strong style={{ color: "#e2e8f0" }}>grocery / food-price
        heuristic</strong>, then a tiny lexicon assigns a rough tone. When nothing matches, we still list{" "}
        <strong style={{ color: "#e2e8f0" }}>unfiltered hot threads</strong> so the page stays useful — not a Nielsen
        score.
      </p>

      {loading && <p style={{ color: "#64748b" }}>Fetching Reddit…</p>}

      {data && (
        <>
          {data.error && (
            <div style={{ ...S.card, borderColor: "#7f1d1d", color: "#fca5a5" }}>
              {data.error}
            </div>
          )}
          {data.usedFallback && (
            <div
              style={{
                ...S.card,
                borderColor: "#854d0e",
                background: "rgba(66, 32, 6, 0.35)",
                color: "#fde68a",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <strong>No grocery-tagged titles</strong> in this refresh (common when “hot” is mostly politics or
              sports). Showing <strong>general hot threads</strong> instead; lexicon score is neutral until grocery-titled
              posts appear.
            </div>
          )}
          <div style={S.card}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Last fetch <span style={{ color: "#cbd5e1" }}>{data.fetchedAt}</span> · grocery-tagged posts{" "}
              <span style={{ color: "#cbd5e1" }}>{data.matchedCount}</span>
              {data.usedFallback ? (
                <span style={{ color: "#94a3b8" }}> · showing hot-sample fallback</span>
              ) : null}
            </p>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: `6px solid ${scoreColor(score, hasGrocerySignal)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  background: "#0f172a",
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 900, color: scoreColor(score, hasGrocerySignal) }}>
                  {hasGrocerySignal ? score.toFixed(2) : "—"}
                </span>
                <span style={{ fontSize: 11, color: "#64748b", textAlign: "center", padding: "0 6px" }}>
                  {hasGrocerySignal ? "lexicon avg." : "no grocery match"}
                </span>
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>{data.methodology}</p>
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
                  Subreddits: {data.subreddits?.join(", ")}
                </p>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>
              {data.usedFallback ? "Hot threads (fallback)" : "Grocery-related threads"}
            </h3>
            {data.posts.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 14 }}>
                Reddit returned no posts (blocked, rate-limited, or network). Retry later or check API logs on the
                server.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
                {data.posts.map((p, i) => (
                  <li
                    key={`${p.link}-${i}`}
                    style={{
                      border: "1px solid #334155",
                      borderRadius: 10,
                      padding: "12px 14px",
                      background: "#0f172a",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span>r/{p.subreddit}</span>
                      {p.groceryMatch ? (
                        <span style={{ color: "#4ade80" }}>grocery tag · sentiment {p.sentiment.toFixed(2)}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>general hot · sentiment n/a</span>
                      )}
                    </div>
                    <a href={p.link} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc", fontWeight: 600, fontSize: 15 }}>
                      {p.title}
                    </a>
                    {p.published && <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{p.published}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={S.card}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Free vs paid Reddit access</h3>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>
              <strong style={{ color: "#e2e8f0" }}>Free (this build):</strong> unauthenticated{" "}
              <code style={{ color: "#cbd5e1" }}>.json</code> listings with a descriptive <code style={{ color: "#cbd5e1" }}>User-Agent</code>{" "}
              — fine for dashboards with caching; Reddit may throttle aggressive IPs.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>
              <strong style={{ color: "#e2e8f0" }}>Still free, more robust:</strong> create a “script” or “installed app” at{" "}
              <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" style={{ color: "#7dd3fc" }}>
                reddit.com/prefs/apps
              </a>{" "}
              to get a <code style={{ color: "#cbd5e1" }}>client_id</code> / secret and call OAuth endpoints with higher
              quotas and clearer compliance.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>
              <strong style={{ color: "#e2e8f0" }}>Alternatives:</strong> Google Alerts + manual curation, NewsAPI / GDELT
              for news tone, or vendor social listening (Brandwatch, Sprinklr) for enterprise scale.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
