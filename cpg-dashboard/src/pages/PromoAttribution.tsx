import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import { useWeatherContext } from "./WeatherContext";
import LastUpdated from "./LastUpdated";

interface TacticRow {
  category: string;
  store_tier: string;
  best_tactic: string;
  lift: number;
  baseline_units: number;
}

interface CarboRow {
  commodity: string;
  feature_type: string;
  display_type: string;
  baskets: number;
  total_units: number;
  total_sales: number;
}

interface PromoData {
  best_tactic_by_category: TacticRow[];
  best_store_tier_for_activation: string;
  store_tier_lift_scores: Record<string, number>;
  carbo_top_promo: CarboRow[];
}

type SortKey = keyof TacticRow | keyof CarboRow;
type SortDir = "asc" | "desc";

const tierColors: Record<string, { bg: string; text: string }> = {
  MAINSTREAM: { bg: "#1d4ed8", text: "#fff" },
  VALUE:      { bg: "#15803d", text: "#fff" },
  UPSCALE:    { bg: "#7e22ce", text: "#fff" },
};

const S = {
  page: { padding: "32px 28px", maxWidth: 1100 } as React.CSSProperties,
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#22d3ee", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 24, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px", marginBottom: 20 } as React.CSSProperties,
  calloutBlue: { background: "#0f2a4a", border: "1px solid #1d4ed8", borderLeft: "4px solid #3b82f6", borderRadius: 10, padding: "18px 22px", marginBottom: 20 } as React.CSSProperties,
  calloutTitle: { fontSize: 13, fontWeight: 800, color: "#93c5fd", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  calloutBody: { fontSize: 15, color: "#cbd5e1", lineHeight: 1.7 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 } as React.CSSProperties,
  kpiCard: (color: string) => ({ background: "#1e293b", border: `2px solid ${color}`, borderRadius: 12, padding: "20px 16px", textAlign: "center" as const }),
  kpiValue: (color: string) => ({ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }),
  kpiLabel: { fontSize: 11, fontWeight: 700, color: "#94a3b8", marginTop: 6, textTransform: "uppercase" as const, letterSpacing: "0.07em" },
  badge: (bg: string, text: string) => ({ background: bg, color: text, borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const, display: "inline-block" }),
  th: { padding: "12px 14px", fontWeight: 700, fontSize: 12, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #334155", background: "#0f172a", cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const },
  td: { padding: "13px 14px", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #1e293b" },
  tdBold: { padding: "13px 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderBottom: "1px solid #1e293b" },
  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#f1f5f9", marginBottom: 16, marginTop: 0 },
};

function getWeatherContext(avgTemp: number, threshold: number): { label: string; color: string; tip: string } {
  if (avgTemp < threshold) {
    if (avgTemp < 5) return { label: "Freezing Cold", color: "#38bdf8", tip: "Maximum promo uplift window. Activate display + mailer combinations immediately." };
    if (avgTemp < 12) return { label: "Cold Weather Active", color: "#22d3ee", tip: "Cold trigger fired. Comfort food promotions will outperform. Focus on Mainstream stores." };
    return { label: "Cool — Near Threshold", color: "#fbbf24", tip: "Just below trigger. Light promo activation recommended for Pasta & Soup." };
  }
  if (avgTemp < 20) return { label: "Mild — Shoulder Season", color: "#94a3b8", tip: "No cold trigger. Everyday value promotions work best in mild conditions." };
  return { label: "Warm Weather", color: "#f87171", tip: "Warm season: shift focus to Soft Drinks, Snacks, BBQ categories." };
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span style={{ color: "#475569", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "#38bdf8", marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function PromoAttribution() {
  const { selectedCity, avgTemp, threshold } = useWeatherContext();
  const [fetchedAt, setFetchedAt] = useState<number|null>(null);
  const [data, setData] = useState<PromoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tacticSort, setTacticSort] = useState<{ key: keyof TacticRow; dir: SortDir }>({ key: "lift", dir: "desc" });
  const [carboSort, setCarboSort] = useState<{ key: keyof CarboRow; dir: SortDir }>({ key: "baskets", dir: "desc" });
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/promo"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed");
        setData(json as PromoData);
        setFetchedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#94a3b8", fontSize: 16 }}>Loading promo signals…</div>;
  if (error) return <div style={{ padding: 40, color: "#f87171", fontSize: 16 }}>{error}</div>;
  if (!data) return null;

  const weatherCtx = getWeatherContext(avgTemp, threshold);
  const tierScores = data.store_tier_lift_scores ?? {};
  const topTier = data.best_store_tier_for_activation;

  const sortTactic = (key: keyof TacticRow) => {
    setTacticSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  };
  const sortCarbo = (key: keyof CarboRow) => {
    setCarboSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  };

  const sortedTactics = [...data.best_tactic_by_category].sort((a, b) => {
    const av = a[tacticSort.key], bv = b[tacticSort.key];
    if (typeof av === "number" && typeof bv === "number") return tacticSort.dir === "asc" ? av - bv : bv - av;
    return tacticSort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const sortedCarbo = [...data.carbo_top_promo].sort((a, b) => {
    const av = a[carboSort.key], bv = b[carboSort.key];
    if (typeof av === "number" && typeof bv === "number") return carboSort.dir === "asc" ? av - bv : bv - av;
    return carboSort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  return (
    <div style={S.page}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, flexWrap:"wrap", gap:12 }}>
        <div>
          <p style={{...S.eyebrow, marginBottom:4}}>Signals</p>
          <h2 style={{...S.h2, marginBottom:0}}>Promo Attribution</h2>
        </div>
        <LastUpdated fetchedAt={fetchedAt} />
      </div>

      {/* ── Live context banner from Dashboard ── */}
      <div style={{
        background: "#0f172a",
        border: `1px solid ${weatherCtx.color}44`,
        borderLeft: `4px solid ${weatherCtx.color}`,
        borderRadius: 10,
        padding: "14px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Live Context from Dashboard</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            {selectedCity} · {avgTemp.toFixed(1)}°C avg · Trigger at {threshold}°C
          </div>
        </div>
        <div style={{
          background: `${weatherCtx.color}18`,
          border: `1px solid ${weatherCtx.color}44`,
          borderRadius: 8,
          padding: "8px 14px",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: weatherCtx.color }}>{weatherCtx.label}</span>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{weatherCtx.tip}</div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={S.kpiGrid}>
        {Object.entries(tierScores).map(([tier, score]) => {
          const c = tierColors[tier]?.bg ?? "#475569";
          return (
            <div key={tier} style={S.kpiCard(c)}>
              <div style={S.kpiValue(c)}>{score.toFixed(2)}×</div>
              <div style={S.kpiLabel}>{tier} lift</div>
              {tier === topTier && (
                <div style={{ marginTop: 10 }}>
                  <span style={S.badge("#1d4ed8", "#fff")}>★ Best Tier</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insight callout */}
      <div style={S.calloutBlue}>
        <div style={S.calloutTitle}>Activation Recommendation</div>
        <div style={S.calloutBody}>
          <strong style={{ color: "#f1f5f9" }}>{topTier}</strong> stores deliver the highest promo lift at{" "}
          <strong style={{ color: "#34d399" }}>{(tierScores[topTier] ?? 0).toFixed(2)}×</strong>.
          Prioritise <strong style={{ color: "#f1f5f9" }}>Display + Mailer</strong> combinations — Cold Cereal
          and Bag Snacks both respond strongly to this tactic. Front Page Features paired with Rear End Cap
          placement drive the best basket conversion for Pasta Sauce in Carbo-Loading data.
        </div>
      </div>

      {/* Best tactic table */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Best Promo Tactic by Category <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>— click column headers to sort</span></h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {(["category", "store_tier", "best_tactic", "lift", "baseline_units"] as (keyof TacticRow)[]).map(k => (
                  <th key={k} style={S.th} onClick={() => sortTactic(k)}>
                    {k === "category" ? "Category" : k === "store_tier" ? "Store Tier" : k === "best_tactic" ? "Best Tactic" : k === "lift" ? "Promo Lift" : "Baseline Units/Wk"}
                    <SortIcon dir={tacticSort.key === k ? tacticSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTactics.map((row, i) => {
                const rowId = `t${i}`;
                const hovered = hoveredRow === rowId;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={S.tdBold}>{row.category}</td>
                    <td style={S.td}><span style={S.badge(tierColors[row.store_tier]?.bg ?? "#475569", "#fff")}>{row.store_tier}</span></td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 13 }}>{row.best_tactic}</td>
                    <td style={S.td}><span style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>{row.lift.toFixed(2)}×</span></td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{row.baseline_units.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carbo table */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Carbo-Loading: Top Promo Combinations <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>— click to sort</span></h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {(["commodity", "feature_type", "display_type", "baskets", "total_units", "total_sales"] as (keyof CarboRow)[]).map(k => (
                  <th key={k} style={S.th} onClick={() => sortCarbo(k)}>
                    {k === "commodity" ? "Commodity" : k === "feature_type" ? "Feature Type" : k === "display_type" ? "Display Type" : k === "baskets" ? "Baskets" : k === "total_units" ? "Units Sold" : "Revenue"}
                    <SortIcon dir={carboSort.key === k ? carboSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCarbo.map((row, i) => {
                const rowId = `c${i}`;
                const hovered = hoveredRow === rowId;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={{ ...S.tdBold, textTransform: "capitalize" }}>{row.commodity}</td>
                    <td style={S.td}>{row.feature_type}</td>
                    <td style={S.td}>{row.display_type}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{row.baskets.toLocaleString()}</td>
                    <td style={S.td}>{row.total_units.toLocaleString()}</td>
                    <td style={{ ...S.td, color: "#34d399", fontWeight: 800, fontSize: 15 }}>${row.total_sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
