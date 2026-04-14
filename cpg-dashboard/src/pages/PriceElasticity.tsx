import { useEffect, useState } from "react";
import { apiUrl } from "../api";

interface ElasticCategory {
  category: string;
  store_tier: string;
  elasticity_coef: number;
  interpretation: string;
  avg_price: number;
  avg_units: number;
}

interface DiscountRow {
  category: string;
  discount_tier: string;
  avg_units: number;
  avg_visits: number;
  avg_households: number;
  observations: number;
}

interface StoreTierRow {
  store_tier: string;
  store_count: number;
  avg_sqft: number;
  avg_weekly_baskets: number;
  avg_shelf_price: number;
  avg_discount_amount: number;
  avg_units_per_sku_week: number;
}

interface ElasticityData {
  most_elastic_categories: ElasticCategory[];
  discount_depth_impact: DiscountRow[];
  store_tier_summary: StoreTierRow[];
}

const tierColors: Record<string, string> = { MAINSTREAM: "#1d4ed8", VALUE: "#15803d", UPSCALE: "#7e22ce" };
const discountColors: Record<string, string> = { "0-5% off": "#475569", "5-15% off": "#0369a1", "15-30% off": "#b45309", "30%+ off": "#b91c1c" };

const S = {
  page: { padding: "32px 28px", maxWidth: 1100 } as React.CSSProperties,
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#22d3ee", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 24, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px", marginBottom: 20 } as React.CSSProperties,
  callout: { background: "#1c1a06", border: "1px solid #854d0e", borderLeft: "4px solid #eab308", borderRadius: 10, padding: "18px 22px", marginBottom: 20 } as React.CSSProperties,
  calloutTitle: { fontSize: 13, fontWeight: 800, color: "#fde047", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  calloutBody: { fontSize: 15, color: "#fef9c3", lineHeight: 1.7 },
  th: { padding: "12px 14px", fontWeight: 700, fontSize: 12, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #334155", background: "#0f172a", cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const },
  td: { padding: "13px 14px", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #263040" },
  tdBold: { padding: "13px 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderBottom: "1px solid #263040" },
  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#f1f5f9", marginBottom: 16, marginTop: 0 },
  badge: (bg: string) => ({ background: bg, color: "#fff", borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const, display: "inline-block" }),
  select: { fontSize: 14, padding: "8px 14px", borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#e2e8f0", cursor: "pointer" } as React.CSSProperties,
};

type ElasticSortKey = keyof ElasticCategory;
type DiscountSortKey = keyof DiscountRow;

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <span style={{ color: "#475569", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "#38bdf8", marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

function ElasticBar({ value }: { value: number }) {
  const abs = Math.min(Math.abs(value) / 1.5, 1) * 100;
  const color = Math.abs(value) > 1 ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: "#0f172a", borderRadius: 4, height: 10, overflow: "hidden", minWidth: 80 }}>
        <div style={{ width: `${abs}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontWeight: 800, color, fontSize: 14, minWidth: 48 }}>{value.toFixed(3)}</span>
    </div>
  );
}

export default function PriceElasticity() {
  const [data, setData] = useState<ElasticityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [elasticSort, setElasticSort] = useState<{ key: ElasticSortKey; dir: "asc" | "desc" }>({ key: "elasticity_coef", dir: "asc" });
  const [discountSort, setDiscountSort] = useState<{ key: DiscountSortKey; dir: "asc" | "desc" }>({ key: "avg_units", dir: "desc" });
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/price-elasticity"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed");
        setData(json as ElasticityData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#94a3b8", fontSize: 16 }}>Loading elasticity signals…</div>;
  if (error) return <div style={{ padding: 40, color: "#f87171", fontSize: 16 }}>{error}</div>;
  if (!data) return null;

  const categories = [...new Set(data.discount_depth_impact.map(r => r.category))];
  const discountOrder = ["0-5% off", "5-15% off", "15-30% off", "30%+ off"];

  const sortedElastic = [...data.most_elastic_categories].sort((a, b) => {
    const av = a[elasticSort.key], bv = b[elasticSort.key];
    if (typeof av === "number" && typeof bv === "number") return elasticSort.dir === "asc" ? av - bv : bv - av;
    return elasticSort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const filteredDiscount = (selectedCategory === "ALL" ? data.discount_depth_impact : data.discount_depth_impact.filter(r => r.category === selectedCategory))
    .sort((a, b) => {
      if (discountSort.key === "discount_tier") {
        const ai = discountOrder.indexOf(a.discount_tier), bi = discountOrder.indexOf(b.discount_tier);
        return discountSort.dir === "asc" ? ai - bi : bi - ai;
      }
      const av = a[discountSort.key], bv = b[discountSort.key];
      if (typeof av === "number" && typeof bv === "number") return discountSort.dir === "asc" ? av - bv : bv - av;
      return 0;
    });

  return (
    <div style={S.page}>
      <p style={S.eyebrow}>Signals</p>
      <h2 style={S.h2}>Price Elasticity</h2>

      <div style={S.callout}>
        <div style={S.calloutTitle}>Key Insight</div>
        <div style={S.calloutBody}>
          <strong>Bag Snacks</strong> and <strong>Frozen Pizza</strong> are the most price-sensitive categories (elasticity &gt; 1.0) —
          a 5–10% price reduction drives disproportionate volume uplift.
          Cold Cereal in MAINSTREAM stores responds dramatically to deep discounts,
          with units tripling at the <strong>30%+ off</strong> tier. Use this to time promotional windows.
        </div>
      </div>

      {/* Elasticity table */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Elasticity by Category &amp; Store Tier <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>— click headers to sort</span></h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {([
                  ["category", "Category"],
                  ["store_tier", "Store Tier"],
                  ["elasticity_coef", "Elasticity"],
                  ["interpretation", "Sensitivity"],
                  ["avg_price", "Avg Price"],
                  ["avg_units", "Avg Units/Wk"],
                ] as [ElasticSortKey, string][]).map(([k, label]) => (
                  <th key={k} style={S.th} onClick={() => setElasticSort(prev => ({ key: k, dir: prev.key === k && prev.dir === "desc" ? "asc" : "desc" }))}>
                    {label}<SortIcon dir={elasticSort.key === k ? elasticSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedElastic.map((row, i) => {
                const rowId = `e${i}`;
                const hovered = hoveredRow === rowId;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={S.tdBold}>{row.category}</td>
                    <td style={S.td}><span style={S.badge(tierColors[row.store_tier] ?? "#475569")}>{row.store_tier}</span></td>
                    <td style={{ ...S.td, minWidth: 200 }}><ElasticBar value={row.elasticity_coef} /></td>
                    <td style={{ ...S.td, color: Math.abs(row.elasticity_coef) > 1 ? "#f87171" : "#fbbf24", fontWeight: 700 }}>
                      {Math.abs(row.elasticity_coef) > 1 ? "⚡ Highly Elastic" : "Elastic"}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>${row.avg_price.toFixed(2)}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{row.avg_units.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discount depth */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 0 }}>Discount Depth Impact on Volume</h3>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={S.select}>
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {([
                  ["category", "Category"],
                  ["discount_tier", "Discount Tier"],
                  ["avg_units", "Avg Units/Wk"],
                  ["avg_visits", "Store Visits"],
                  ["avg_households", "Households"],
                  ["observations", "Observations"],
                ] as [DiscountSortKey, string][]).map(([k, label]) => (
                  <th key={k} style={S.th} onClick={() => setDiscountSort(prev => ({ key: k, dir: prev.key === k && prev.dir === "desc" ? "asc" : "desc" }))}>
                    {label}<SortIcon dir={discountSort.key === k ? discountSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDiscount.map((row, i) => {
                const rowId = `d${i}`;
                const hovered = hoveredRow === rowId;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={S.tdBold}>{row.category}</td>
                    <td style={S.td}><span style={S.badge(discountColors[row.discount_tier] ?? "#475569")}>{row.discount_tier}</span></td>
                    <td style={{ ...S.td, color: "#34d399", fontWeight: 800, fontSize: 16 }}>{row.avg_units.toFixed(1)}</td>
                    <td style={S.td}>{row.avg_visits.toFixed(1)}</td>
                    <td style={S.td}>{row.avg_households.toFixed(1)}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{row.observations.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store tier cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {data.store_tier_summary.map(tier => (
          <div key={tier.store_tier} style={{ ...S.card, marginBottom: 0, borderTop: `3px solid ${tierColors[tier.store_tier] ?? "#475569"}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: tierColors[tier.store_tier] ?? "#e2e8f0", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tier.store_tier}</div>
            {([
              ["Stores", tier.store_count],
              ["Avg Sq Ft", tier.avg_sqft.toLocaleString()],
              ["Weekly Baskets", tier.avg_weekly_baskets.toLocaleString()],
              ["Avg Shelf Price", `$${tier.avg_shelf_price.toFixed(2)}`],
              ["Units / SKU / Wk", tier.avg_units_per_sku_week.toFixed(1)],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "7px 0", borderBottom: "1px solid #334155" }}>
                <span style={{ color: "#94a3b8" }}>{label}</span>
                <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
