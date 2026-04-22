import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import { useWeatherContext } from "./WeatherContext";
import LastUpdated from "./LastUpdated";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { useUiDensity } from "../components/UiDensity";

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

function getPricingAdvice(
  avgTemp: number,
  threshold: number,
  hotThreshold: number,
  coldActive: boolean,
  hotActive: boolean
): string {
  if (coldActive) {
    if (avgTemp < 5) {
      return "Cold lane + freezing: comfort staples are price-inelastic. Hold prices on Soup & Pasta — uplift comes from weather, not discounts. Reserve 15–30% off for Snacks and Cereal to grow basket size.";
    }
    return "Cold lane active: Soup and Hot Beverages show reduced price sensitivity. A 5–15% promotion can expand baskets without sacrificing margin. Avoid deep cuts on cold-weather staples.";
  }
  if (hotActive) {
    return "Hot lane active: Soft Drinks and Ice Cream are highly elastic. A 10–15% price drop can lift volume; BBQ Meats respond best to multi-buy bundles rather than straight discounts.";
  }
  if (avgTemp >= 20) {
    return "Warm season: Soft Drinks and Ice Cream are highly elastic in summer. A 10–15% price drop can significantly boost volume. BBQ Meats respond best to multi-buy bundles rather than straight discounts.";
  }
  if (avgTemp < threshold) {
    return "Below your cold cut-off but not in the cold lane (needs wet codes). Moderate discounting (5–15% off) works across categories until a wet window appears.";
  }
  if (avgTemp > hotThreshold) {
    return "Above your hot cut-off but wet codes are present — elasticity is mixed. Pair chilled displays with targeted digital offers instead of blanket deep discounts.";
  }
  return "Shoulder season: moderate discounting (5–15% off) works across most categories. Everyday value messaging outperforms deep promotional price cuts in mild weather.";
}

export default function PriceElasticity() {
  const { selectedCity, avgTemp, threshold, hotThreshold, coldPromoActive, hotPromoActive } = useWeatherContext();
  const { density } = useUiDensity();
  const [fetchedAt, setFetchedAt] = useState<number|null>(null);
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
        setFetchedAt(Date.now());
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

  const filteredDiscount = selectedCategory === "ALL"
    ? data.discount_depth_impact
    : data.discount_depth_impact.filter(r => r.category === selectedCategory);

  const sortedDiscount = [...filteredDiscount].sort((a, b) => {
    const av = a[discountSort.key], bv = b[discountSort.key];
    if (typeof av === "number" && typeof bv === "number") return discountSort.dir === "asc" ? av - bv : bv - av;
    return discountSort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const tempColor = coldPromoActive ? "#22d3ee" : hotPromoActive ? "#fb923c" : avgTemp < threshold ? "#38bdf8" : avgTemp > hotThreshold ? "#f87171" : "#94a3b8";

  return (
    <div style={S.page}>
      <PageHeader
        eyebrow="Signals"
        title="Price Elasticity"
        description="Which categories respond most to price, and how discount depth / store tier changes the lift."
        right={<LastUpdated fetchedAt={fetchedAt} />}
      />

      <SectionCard
        title="Live pricing guidance"
        subtitle={`${selectedCity} · ${avgTemp.toFixed(1)}°C avg`}
        storageKey="sec:elasticity:context"
        defaultCollapsed={density === "executive"}
      >
        <div style={{
          background: "#0f172a",
          border: `1px solid ${tempColor}44`,
          borderLeft: `4px solid ${tempColor}`,
          borderRadius: 10,
          padding: "14px 20px",
        }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Dashboard thresholds — cold below {threshold}°C · hot above {hotThreshold}°C
          </div>
          <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>
            <strong style={{ color: "#f1f5f9" }}>Pricing strategy:</strong>{" "}
            {getPricingAdvice(avgTemp, threshold, hotThreshold, coldPromoActive, hotPromoActive)}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Elasticity insight" subtitle="How to read this" storageKey="sec:elasticity:insight" defaultCollapsed={false}>
        <div style={S.calloutBody}>
          Categories with elasticity coefficient &gt; 1.0 (in absolute terms) are <strong>highly price-sensitive</strong> — small discounts drive large volume swings.
          Categories below 1.0 are <strong>inelastic</strong> — weather and convenience matter more than price. Use the tables below to calibrate promotional depth by store tier.
        </div>
      </SectionCard>

      {/* Elasticity table */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Most Elastic Categories <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>— click to sort</span></h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {(["category", "store_tier", "elasticity_coef", "interpretation", "avg_price", "avg_units"] as ElasticSortKey[]).map(k => (
                  <th key={k} style={S.th} onClick={() => setElasticSort(prev => ({ key: k, dir: prev.key === k && prev.dir === "desc" ? "asc" : "desc" }))}>
                    {k === "category" ? "Category" : k === "store_tier" ? "Store Tier" : k === "elasticity_coef" ? "Elasticity" : k === "interpretation" ? "Price Sensitivity" : k === "avg_price" ? "Avg Price" : "Avg Units/Wk"}
                    <SortIcon dir={elasticSort.key === k ? elasticSort.dir : null} />
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
                    <td style={{ ...S.td, minWidth: 140 }}><ElasticBar value={row.elasticity_coef} /></td>
                    <td style={{ ...S.td, fontSize: 13, color: Math.abs(row.elasticity_coef) > 1 ? "#fca5a5" : "#86efac" }}>{row.interpretation}</td>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 0 }}>Discount Depth Impact</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Filter category:</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={S.select}>
              <option value="ALL">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {(["category", "discount_tier", "avg_units", "avg_visits", "avg_households", "observations"] as DiscountSortKey[]).map(k => (
                  <th key={k} style={S.th} onClick={() => setDiscountSort(prev => ({ key: k, dir: prev.key === k && prev.dir === "desc" ? "asc" : "desc" }))}>
                    {k === "category" ? "Category" : k === "discount_tier" ? "Discount Tier" : k === "avg_units" ? "Avg Units" : k === "avg_visits" ? "Visits" : k === "avg_households" ? "Households" : "Observations"}
                    <SortIcon dir={discountSort.key === k ? discountSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDiscount.map((row, i) => {
                const rowId = `d${i}`;
                const hovered = hoveredRow === rowId;
                const discountIdx = discountOrder.indexOf(row.discount_tier);
                const discountPct = discountIdx >= 0 ? (discountIdx + 1) / discountOrder.length * 100 : 30;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={S.tdBold}>{row.category}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 40, height: 8, background: "#0f172a", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${discountPct}%`, height: "100%", background: discountColors[row.discount_tier] ?? "#475569", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: discountColors[row.discount_tier] ?? "#94a3b8", fontWeight: 700 }}>{row.discount_tier}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#34d399" }}>{row.avg_units.toFixed(1)}</td>
                    <td style={S.td}>{row.avg_visits.toFixed(1)}</td>
                    <td style={S.td}>{row.avg_households.toFixed(1)}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{row.observations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store tier summary */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Store Tier Summary</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Store Tier", "Stores", "Avg SqFt", "Baskets/Wk", "Shelf Price", "Avg Discount", "Units/SKU/Wk"].map(label => (
                  <th key={label} style={{ ...S.th, cursor: "default" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.store_tier_summary.map((row, i) => (
                <tr key={i}>
                  <td style={S.tdBold}><span style={S.badge(tierColors[row.store_tier] ?? "#475569")}>{row.store_tier}</span></td>
                  <td style={S.td}>{row.store_count}</td>
                  <td style={S.td}>{row.avg_sqft.toLocaleString()}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{row.avg_weekly_baskets.toFixed(0)}</td>
                  <td style={S.td}>${row.avg_shelf_price.toFixed(2)}</td>
                  <td style={{ ...S.td, color: "#f87171" }}>-${row.avg_discount_amount.toFixed(2)}</td>
                  <td style={{ ...S.td, color: "#34d399", fontWeight: 700 }}>{row.avg_units_per_sku_week.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
