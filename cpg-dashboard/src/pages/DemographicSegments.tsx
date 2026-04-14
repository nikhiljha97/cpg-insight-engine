import { useEffect, useState } from "react";
import { apiUrl } from "../api";

interface Segment {
  age_group: string;
  income_group: string;
  has_kids: string;
  homeowner: string;
  marital_status: string;
  soup_buyers: number;
  total_buyers: number;
  soup_penetration_pct: number;
}

interface CouponRow {
  DEPARTMENT: string;
  total_hh: number;
  coupon_users: number;
  coupon_pct: number;
}

interface SpendRow {
  period: string;
  weeks: string;
  segment: string;
  avg_spend: number;
}

interface TopSegment {
  age_group: string;
  income_group: string;
  has_kids: string;
  homeowner: string;
  soup_penetration_pct: number;
}

interface DemoData {
  top_soup_buyer_segment: TopSegment;
  all_segments: Segment[];
  coupon_usage_by_dept: CouponRow[];
  spend_trajectory: SpendRow[];
}

function PenetrationBar({ pct, buyers, total }: { pct: number; buyers: number; total: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 3 }}>
        <span>{buyers} of {total} buyers</span>
        <span style={{ fontWeight: 700, color: pct === 100 ? "#16a34a" : "#f59e0b" }}>{pct}%</span>
      </div>
      <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : "#f59e0b", borderRadius: 4 }} />
      </div>
    </div>
  );
}

const ageLabelMap: Record<string, string> = {
  "Age Group1": "18–24",
  "Age Group2": "25–34",
  "Age Group3": "35–44",
  "Age Group4": "45–54",
  "Age Group5": "55–64",
  "Age Group6": "65+",
};

const incomeLabelMap: Record<string, string> = {
  "Level1": "Under $15K",
  "Level2": "$15–25K",
  "Level3": "$25–35K",
  "Level4": "$35–50K",
  "Level5": "$50–75K",
  "Level6": "$75–100K",
  "Level7": "$100–125K",
  "Level8": "$125–150K",
  "Level9": "Over $150K",
};

export default function DemographicSegments() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/demographics"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load demographic signals");
        setData(json as DemoData);
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

  const top = data.top_soup_buyer_segment;

  // Build spend trajectory comparison
  const periods = ["early", "mid", "late"];
  const periodLabels: Record<string, string> = { early: "Weeks 1–34", mid: "Weeks 35–68", late: "Weeks 69–102" };
  const spendBySeg = (seg: string) =>
    periods.map(p => data.spend_trajectory.find(r => r.period === p && r.segment === seg)?.avg_spend ?? 0);

  const soupSpend = spendBySeg("Soup Buyer");
  const nonSoupSpend = spendBySeg("Non-Soup Buyer");

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Demographic Segments</h2>
        </div>
      </header>

      {/* Top segment hero card */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)", color: "#fff", marginBottom: 24, padding: "24px 28px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75, marginBottom: 8 }}>
          Highest-Value Soup Buyer Segment
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>
          {ageLabelMap[top.age_group] ?? top.age_group} · {incomeLabelMap[top.income_group] ?? top.income_group}
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            ["Soup Penetration", `${top.soup_penetration_pct}%`],
            ["Kids in HH", top.has_kids === "None/Unknown" ? "No / Unknown" : top.has_kids],
            ["Homeowner", top.homeowner],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight callout */}
      <div className="card" style={{ background: "#f0fdf4", borderLeft: "4px solid #16a34a", marginBottom: 24, padding: "16px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#14532d", marginBottom: 4 }}>Targeting Insight</div>
        <div style={{ fontSize: 14, color: "#166534", lineHeight: 1.6 }}>
          Multiple segments show <strong>100% soup penetration</strong> — every household in these groups buys soup.
          The 45–54 age group at lower income levels represents the highest-volume targeting opportunity.
          Loyalty coupon stacks perform best in <strong>Frozen Grocery (30.6%)</strong> and <strong>Dairy Deli (30%)</strong> departments.
        </div>
      </div>

      {/* All segments table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title-row" style={{ marginBottom: 16 }}>
          <h3>Soup Buyer Segments — Top 10</h3>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Ranked by penetration rate</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Age Group", "Income", "Has Kids", "Homeowner", "Soup Penetration"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.all_segments.slice(0, 10).map((seg, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{ageLabelMap[seg.age_group] ?? seg.age_group}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{incomeLabelMap[seg.income_group] ?? seg.income_group}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{seg.has_kids === "None/Unknown" ? "—" : seg.has_kids}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{seg.homeowner}</td>
                  <td style={{ padding: "10px 12px", minWidth: 180 }}>
                    <PenetrationBar pct={seg.soup_penetration_pct} buyers={seg.soup_buyers} total={seg.total_buyers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spend trajectory + Coupon usage side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Spend trajectory */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Avg Spend Trajectory</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Period", "Soup Buyers", "Non-Soup Buyers", "Gap"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => {
                const gap = nonSoupSpend[i] - soupSpend[i];
                return (
                  <tr key={p} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{periodLabels[p]}</td>
                    <td style={{ padding: "8px 10px", color: "#2563eb", fontWeight: 700 }}>${soupSpend[i].toFixed(3)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>${nonSoupSpend[i].toFixed(3)}</td>
                    <td style={{ padding: "8px 10px", color: gap > 0 ? "#dc2626" : "#16a34a", fontSize: 12 }}>
                      {gap > 0 ? "▲" : "▼"} ${Math.abs(gap).toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
            Non-soup buyers spend slightly more per visit — soup buyers represent a high-frequency, loyalty-oriented segment.
          </div>
        </div>

        {/* Coupon usage by dept */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Coupon Redemption by Department</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.coupon_usage_by_dept.map(row => (
              <div key={row.DEPARTMENT}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{row.DEPARTMENT}</span>
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>{row.coupon_pct}%</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${row.coupon_pct}%`, height: "100%", background: "#2563eb", borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {row.coupon_users.toLocaleString()} of {row.total_hh.toLocaleString()} HH used coupons
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
