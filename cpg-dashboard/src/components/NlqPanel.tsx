import { apiUrl } from "../api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useWeatherContext } from "../pages/WeatherContext";

export type NlqPanelProps = {
  variant?: "dashboard" | "drawer";
  /** First assistant bubble (e.g. welcome + PDF instructions). */
  introAssistantMessage?: string;
  /** Called when the user sends a message (before the API request). */
  onUserMessage?: (text: string) => void;
};

type NlqBarLineChart = {
  type: "bar" | "line";
  labels: string[];
  values: number[];
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
};

type NlqCardChart = {
  type: "card";
  headline: string;
  detail?: string;
};

export type NlqChart = NlqBarLineChart | NlqCardChart;

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  chart?: NlqChart | null;
};

type NlqChatResponse = {
  reply: string;
  chart?: NlqChart | null;
  error?: string;
};

function formatVal(v: number, decimals: number, prefix = "", suffix = "") {
  const n = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
  return `${prefix}${n}${suffix}`;
}

function ChartView({ chart }: { chart: NlqChart }) {
  if (chart.type === "card") {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "20px 14px",
          background: "#0f172a",
          borderRadius: 12,
          border: "1px solid #334155",
          marginTop: 12,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, color: "#22d3ee", lineHeight: 1.1 }}>{chart.headline}</div>
        {chart.detail && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#94a3b8" }}>{chart.detail}</div>
        )}
      </div>
    );
  }

  const max = Math.max(...chart.values.map((x) => Math.abs(x)), 1e-6);
  const decimals = chart.decimals ?? (chart.type === "bar" ? 1 : 0);
  const prefix = chart.valuePrefix ?? "";
  const suffix = chart.valueSuffix ?? "";

  if (chart.type === "line") {
    const w = 520;
    const h = 130;
    const pad = 8;
    const pts = chart.values.map((val, i) => {
      const x = pad + (i / Math.max(chart.values.length - 1, 1)) * (w - pad * 2);
      const y = pad + (1 - val / max) * (h - pad * 2);
      return `${x},${y}`;
    });
    return (
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <svg width={w} height={h} style={{ display: "block", maxWidth: "100%" }} aria-label="Line chart">
          <polyline fill="none" stroke="#22d3ee" strokeWidth={2.5} points={pts.join(" ")} />
          {chart.values.map((val, i) => {
            const x = pad + (i / Math.max(chart.values.length - 1, 1)) * (w - pad * 2);
            const y = pad + (1 - val / max) * (h - pad * 2);
            return <circle key={i} cx={x} cy={y} r={4} fill="#38bdf8" />;
          })}
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 6,
            fontSize: 11,
            color: "#64748b",
          }}
        >
          {chart.labels.map((lab, i) => (
            <span key={i} style={{ flex: "1 1 auto", textAlign: "center", minWidth: 44 }}>
              {lab}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const trackH = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 140, paddingTop: 8, marginTop: 12 }}>
      {chart.values.map((val, i) => {
        const barH = Math.max(Math.round((val / max) * trackH), 5);
        return (
          <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 4,
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {formatVal(val, decimals, prefix, suffix)}
            </div>
            <div style={{ height: trackH, display: "flex", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 40,
                  height: barH,
                  background: "linear-gradient(180deg,#22d3ee,#0ea5e9)",
                  borderRadius: "6px 6px 2px 2px",
                }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "#64748b", textAlign: "center", lineHeight: 1.2 }}>
              {chart.labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderReplyMarkdown(text: string): React.ReactNode {
  const blocks = text.trim().split(/\n\n+/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n");
    return (
      <div key={bi} style={{ marginBottom: bi < blocks.length - 1 ? 12 : 0 }}>
        {lines.map((line, li) => {
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={li} style={{ margin: li > 0 ? "6px 0 0" : 0, lineHeight: 1.65, color: "#e2e8f0" }}>
              {boldParts.map((part, pi) => {
                const m = part.match(/^\*\*([^*]+)\*\*$/);
                if (m) return <strong key={pi}>{m[1]}</strong>;
                return <span key={pi}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  });
}

const STARTER_CHIPS = [
  "Summarize soup companions and what that implies for cross-merch.",
  "How do recent Ontario retail totals compare to earlier months in the trail?",
  "What does the CPI reading suggest for pricing pressure alongside grocery list prices?",
];

export default function NlqPanel({
  variant = "dashboard",
  introAssistantMessage,
  onUserMessage,
}: NlqPanelProps) {
  const { selectedCity } = useWeatherContext();
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    introAssistantMessage ? [{ role: "assistant", content: introAssistantMessage }] : []
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      onUserMessage?.(trimmed);
      setErr("");
      const nextHistory: ChatTurn[] = [...turns, { role: "user", content: trimmed }];
      setTurns(nextHistory);
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/nlq/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: selectedCity,
            messages: nextHistory.map(({ role, content }) => ({ role, content })),
          }),
        });
        const body = (await res.json()) as NlqChatResponse;
        if (!res.ok) {
          const hint = body.error ?? res.statusText;
          throw new Error(res.status === 503 ? `${hint} (service unavailable)` : hint);
        }
        setTurns((h) => [
          ...h,
          { role: "assistant", content: body.reply ?? "", chart: body.chart ?? null },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        setErr(msg);
        setTurns((h) => h.slice(0, -1));
        setDraft(trimmed);
      } finally {
        setLoading(false);
      }
    },
    [loading, onUserMessage, selectedCity, turns]
  );

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void sendText(text);
  }, [draft, sendText]);

  const isDrawer = variant === "drawer";
  /** Drawer may open with an assistant intro already in `turns` — still show starter chips until the user sends. */
  const showStarterChips = !turns.some((t) => t.role === "user");

  return (
    <div
      className={isDrawer ? undefined : "dash-card"}
      style={{
        marginBottom: isDrawer ? 0 : 20,
        paddingTop: isDrawer ? 4 : undefined,
      }}
    >
      <p className="section-title" style={{ margin: "0 0 6px" }}>
        {isDrawer ? "Ask me anything" : "Query your data"}{" "}
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>(Groq · interactive)</span>
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        {isDrawer ? (
          <>
            Multi-turn copilot grounded in <strong style={{ color: "#94a3b8" }}>unified_signal.json</strong>, the
            macro strip, and Ontario retail. Charts appear when the model returns them. Requires{" "}
            <code style={{ color: "#94a3b8" }}>GROQ_API_KEY</code> on the API server.
          </>
        ) : (
          <>
            Multi-turn copilot grounded in <strong style={{ color: "#94a3b8" }}>unified_signal.json</strong>, the
            macro strip, and the Ontario retail trail. The model may attach a chart when it helps. Requires{" "}
            <code style={{ color: "#94a3b8" }}>GROQ_API_KEY</code> on the API server.
          </>
        )}
      </p>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 14,
          maxHeight: isDrawer ? "min(46vh, 380px)" : 400,
          overflowY: "auto",
          marginBottom: 12,
          minHeight: 120,
        }}
      >
        {turns.length === 0 && !loading && (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            City context: <strong style={{ color: "#e2e8f0" }}>{selectedCity}</strong>. Ask follow-ups in plain
            English; the assistant keeps the thread and stays within the bundled data.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              alignItems: t.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "92%",
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 14,
                background: t.role === "user" ? "#1d4ed8" : "#1e293b",
                border: `1px solid ${t.role === "user" ? "#2563eb" : "#334155"}`,
                color: "#f1f5f9",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 6 }}>
                {t.role === "user" ? "You" : "Assistant"}
              </div>
              {t.role === "assistant" ? renderReplyMarkdown(t.content) : <p style={{ margin: 0, lineHeight: 1.6 }}>{t.content}</p>}
              {t.role === "assistant" && t.chart && <ChartView chart={t.chart} />}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontSize: 13, color: "#64748b", padding: "4px 0" }}>Thinking…</div>
        )}
        <div ref={endRef} />
      </div>

      {showStarterChips && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {STARTER_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={loading}
              onClick={() => void sendText(c)}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#94a3b8",
                cursor: loading ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {err && (
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
          {err}
          {/GROQ|503|unavailable/i.test(err) ? (
            <span> — Set <code style={{ color: "#cbd5e1" }}>GROQ_API_KEY</code> and restart the API.</span>
          ) : null}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask a follow-up… (Enter to send, Shift+Enter for newline)"
          rows={3}
          disabled={loading}
          style={{
            flex: "1 1 240px",
            minWidth: 200,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            fontSize: 14,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            disabled={loading || !draft.trim()}
            onClick={() => void send()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: loading || !draft.trim() ? "#475569" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: loading || !draft.trim() ? "not-allowed" : "pointer",
            }}
          >
            Send
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setTurns([]);
              setErr("");
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "transparent",
              color: "#94a3b8",
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Clear thread
          </button>
        </div>
      </div>
    </div>
  );
}
