import { useEffect, useState } from "react";

interface LastUpdatedProps {
  /** Optional: pass a fetched-at timestamp (ms) from the data fetch.
   *  If omitted, shows the time the component first mounted (page load time). */
  fetchedAt?: number | null;
  /** Optional label override. Default: "Data last refreshed" */
  label?: string;
}

function formatRelative(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatAbsolute(ms: number): string {
  return new Date(ms).toLocaleString("en-CA", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

export default function LastUpdated({ fetchedAt, label = "Data last refreshed" }: LastUpdatedProps) {
  const [ts]      = useState<number>(() => fetchedAt ?? Date.now());
  const [rel, setRel] = useState(() => formatRelative(fetchedAt ?? Date.now()));

  // Re-render the relative label every 30s so "2m ago" stays accurate
  useEffect(() => {
    const id = setInterval(() => setRel(formatRelative(ts)), 30_000);
    return () => clearInterval(id);
  }, [ts]);

  return (
    <div
      title={formatAbsolute(ts)}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            7,
        background:     "#0f172a",
        border:         "1px solid #1e293b",
        borderRadius:   8,
        padding:        "6px 12px",
        fontSize:       12,
        color:          "#64748b",
        fontWeight:     600,
        letterSpacing:  "0.03em",
        whiteSpace:     "nowrap",
        cursor:         "default",
        userSelect:     "none",
      }}
    >
      {/* pulsing green dot */}
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: "#22c55e",
        flexShrink: 0,
        boxShadow: "0 0 0 2px #052e16",
        animation: "lu-pulse 2.4s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes lu-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
      <span style={{ color: "#94a3b8" }}>{label}:</span>
      <span style={{ color: "#e2e8f0" }}>{rel}</span>
    </div>
  );
}
