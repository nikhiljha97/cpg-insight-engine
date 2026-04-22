import { useEffect, useState, type CSSProperties } from "react";
import { apiUrl } from "../api";

type RedditPost = {
  subreddit: string;
  title: string;
  link: string;
  published?: string;
  sentiment: number;
  matched: boolean;
};

type SentimentPayload = {
  fetchedAt: string;
  aggregateScore: number;
  matchedCount: number;
  posts: RedditPost[];
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

function scoreColor(score: number): string {
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

  return (
    <div style={S.page} className="page">
      <p style={S.eyebrow}>Social listening · prototype</p>
      <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>Brand & grocery sentiment (Reddit)</h2>
      <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
        Live-ish snapshot from <strong style={{ color: "#e2e8f0" }}>public Reddit RSS</strong> (hot posts) across major
        Canada-oriented subreddits. Titles are filtered for grocery, food prices, supermarkets, and shopping
        language, then scored with a tiny <strong style={{ color: "#e2e8f0" }}>positive/negative lexicon</strong> — not
        deep NLP and not representative of all consumers. Use to explain <em>possible</em> narrative pressure alongside
        sales, not as a research-grade sentiment index.
      </p>

      {loading && <p style={{ color: "#64748b" }}>Fetching Reddit feeds…</p>}

      {data && (
        <>
          {data.error && (
            <div style={{ ...S.card, borderColor: "#7f1d1d", color: "#fca5a5" }}>
              {data.error}
            </div>
          )}
          <div style={S.card}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Last fetch <span style={{ color: "#cbd5e1" }}>{data.fetchedAt}</span> · matched posts{" "}
              <span style={{ color: "#cbd5e1" }}>{data.matchedCount}</span>
            </p>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: `6px solid ${scoreColor(score)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  background: "#0f172a",
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 900, color: scoreColor(score) }}>{score.toFixed(2)}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>lexicon score</span>
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
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>Recent grocery-related threads</h3>
            {data.posts.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 14 }}>No keyword-matched posts in this refresh — try again later.</p>
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
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                      r/{p.subreddit} · sentiment {p.sentiment.toFixed(2)}
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
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Why Reddit only (for now)</h3>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>
              Full social APIs (X, Meta, TikTok) require paid access or strict developer programs. Reddit offers public
              RSS for many communities, which keeps this feature transparent and server-side without storing
              credentials. A production roadmap would add review aggregators, news APIs, and controlled OAuth sources
              with clear data-retention policies.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
