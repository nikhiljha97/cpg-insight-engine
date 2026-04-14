import { useEffect, useState } from "react";
import { apiUrl } from "../api";

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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: color,
      color: "#fff",
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
    }}>{label}</span>
  );
}

export default function PromoAttribution() {
  const [data, setData] = useState<PromoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/promo"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load promo signals");
        setData(json as PromoData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const tierColors: Record<string, string> = {
    MAINSTREAM: "#2563eb",
    VALUE: "#16a34a",
    UPSCALE: "#9333ea",
  };

  if (loading) return <section className="page"><div className="skeleton pitch-skeleton" style={{ height: 300 }} /></section>;
  if (error) return <section className="page"><div className="callout error">{error}</div></section>;
  if (!data) return null;

  const topTier = data.best_store_tier_for_activation;
  const tierScores = data.store_tier_lift_scores ?? {};
  const maxLift = Math.max(...Object.values(tierScores));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Promo Attribution</h2>
        </div>
      </header>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {Object.entries(tierScores).map(([tier, score]) => (
          <div key={tier} className="card" style={{ textAlign: "center", padding: "20px 16px", borderTop: `4px solid ${tierColors[tier] ?? "#64748b"}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: tierColors[tier] ?? "#64748b" }}>{score.toFixed(2)}x</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {tier} lift
            </div>
            {tier === topTier && <div style={{ marginTop: 8 }}><Badge label="Best Tier" color="#2563eb" /></div>}
          </div>
        ))}
      </div>

      {/* Insight callout */}
      <div className="card" style={{ background: "#eff6ff", borderLeft: "4px solid #2563eb", marginBottom: 24, padding: "16px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e40af", marginBottom: 4 }}>Activation Recommendation</div>
        <div style={{ fontSize: 14, color: "#1e3a8a", lineHeight: 1.6 }}>
          <strong>{topTier}</strong> stores deliver the highest lift at <strong>{maxLift.toFixed(2)}x</strong>.
          Prioritize <strong>Display + Mailer</strong> combinations for Cold Cereal and Bag Snacks — these categories show the strongest response to combined tactic exposure.
        </div>
      </div>

      {/* Best tactic by category */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title-row" style={{ marginBottom: 16 }}>
          <h3>Best Promo Tactic by Category</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Category", "Store Tier", "Best Tactic", "Promo Lift", "Baseline Units/Wk"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.best_tactic_by_category.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.category}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge label={row.store_tier} color={tierColors[row.store_tier] ?? "#64748b"} />
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{row.best_tactic}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 800, color: "#16a34a", fontSize: 15 }}>{row.lift.toFixed(2)}x</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{row.baseline_units.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carbo-Loading promo breakdown */}
      <div className="card">
        <div className="section-title-row" style={{ marginBottom: 16 }}>
          <h3>Carbo-Loading: Top Promo Combinations</h3>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Ranked by total baskets impacted</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Commodity", "Feature Type", "Display Type", "Baskets", "Units Sold", "Revenue"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.carbo_top_promo.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, textTransform: "capitalize" }}>{row.commodity}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#475569" }}>{row.feature_type}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#475569" }}>{row.display_type}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{row.baskets.toLocaleString()}</td>
                  <td style={{ padding: "10px 12px" }}>{row.total_units.toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 600 }}>${row.total_sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
