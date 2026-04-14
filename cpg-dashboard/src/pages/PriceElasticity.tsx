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

function ElasticityBar({ value }: { value: number }) {
  const abs = Math.abs(value);
  const pct = Math.min(abs / 1.5, 1) * 100;
  const color = abs > 1 ? "#dc2626" : abs > 0.5 ? "#f59e0b" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontWeight: 700, color, fontSize: 13, minWidth: 44 }}>{value.toFixed(3)}</span>
    </div>
  );
}

export default function PriceElasticity() {
  const [data, setData] = useState<ElasticityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/price-elasticity"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load elasticity signals");
        setData(json as ElasticityData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <section className="page"><div className="skeleton pitch-skeleton" style={{ height: 300 }} /></section>;
  if (error) return <section className="page"><div className="callout error">{error}</div></section>;
  if (!data) return null;

  const tierColors: Record<string, string> = { MAINSTREAM: "#2563eb", VALUE: "#16a34a", UPSCALE: "#9333ea" };
  const categories = [...new Set(data.discount_depth_impact.map(r => r.category))];
  const filteredDiscount = selectedCategory === "ALL"
    ? data.discount_depth_impact
    : data.discount_depth_impact.filter(r => r.category === selectedCategory);

  const discountOrder = ["0-5% off", "5-15% off", "15-30% off", "30%+ off"];
  const sortedDiscount = [...filteredDiscount].sort((a, b) =>
    discountOrder.indexOf(a.discount_tier) - discountOrder.indexOf(b.discount_tier)
  );

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Price Elasticity</h2>
        </div>
      </header>

      {/* Insight callout */}
      <div className="card" style={{ background: "#fef9c3", borderLeft: "4px solid #ca8a04", marginBottom: 24, padding: "16px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e", marginBottom: 4 }}>Key Insight</div>
        <div style={{ fontSize: 14, color: "#78350f", lineHeight: 1.6 }}>
          <strong>Bag Snacks</strong> and <strong>Frozen Pizza</strong> are the most price-sensitive categories (elasticity &gt; 1.0).
          A <strong>5–10% price reduction</strong> drives disproportionate volume uplift — ideal for promotional price points.
          Cold Cereal in MAINSTREAM stores responds sharply to deep discounts (30%+), tripling unit velocity.
        </div>
      </div>

      {/* Elastic categories */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title-row" style={{ marginBottom: 16 }}>
          <h3>Elasticity by Category &amp; Store Tier</h3>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Higher absolute value = more price-sensitive</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Category", "Store Tier", "Elasticity Coefficient", "Sensitivity", "Avg Price", "Avg Units/Wk"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.most_elastic_categories.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.category}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: tierColors[row.store_tier] ?? "#64748b", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{row.store_tier}</span>
                  </td>
                  <td style={{ padding: "10px 12px", minWidth: 180 }}>
                    <ElasticityBar value={row.elasticity_coef} />
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: Math.abs(row.elasticity_coef) > 1 ? "#dc2626" : "#f59e0b", fontWeight: 600 }}>
                    {Math.abs(row.elasticity_coef) > 1 ? "Highly Elastic" : "Elastic"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>${row.avg_price.toFixed(2)}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.avg_units.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discount depth impact */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Discount Depth Impact on Volume</h3>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Category", "Discount Tier", "Avg Units/Wk", "Avg Store Visits", "Households Reached", "Observations"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDiscount.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.category}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: row.discount_tier === "30%+ off" ? "#dc2626" : row.discount_tier === "15-30% off" ? "#f59e0b" : "#64748b", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{row.discount_tier}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#16a34a" }}>{row.avg_units.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px" }}>{row.avg_visits.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px" }}>{row.avg_households.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{row.observations.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store tier summary */}
      <div className="card">
        <div className="section-title-row" style={{ marginBottom: 16 }}>
          <h3>Store Tier Profile</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {data.store_tier_summary.map(tier => (
            <div key={tier.store_tier} style={{ border: `2px solid ${tierColors[tier.store_tier] ?? "#e2e8f0"}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: tierColors[tier.store_tier] ?? "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tier.store_tier}</div>
              {[
                ["Stores", tier.store_count],
                ["Avg Sq Ft", tier.avg_sqft.toLocaleString()],
                ["Weekly Baskets", tier.avg_weekly_baskets.toLocaleString()],
                ["Avg Shelf Price", `$${tier.avg_shelf_price.toFixed(2)}`],
                ["Units / SKU / Wk", tier.avg_units_per_sku_week.toFixed(1)],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
