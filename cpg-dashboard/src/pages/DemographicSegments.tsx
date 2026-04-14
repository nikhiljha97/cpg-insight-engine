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

interface DemoData {
  top_soup_buyer_segment: Segment;
  all_segments: Segment[];
  coupon_usage_by_dept: CouponRow[];
  spend_trajectory: SpendRow[];
}

const ageLabelMap: Record<string, string> = {
  "Age Group1": "18–24", "Age Group2": "25–34", "Age Group3": "35–44",
  "Age Group4": "45–54", "Age Group5": "55–64", "Age Group6": "65+",
};
const incomeLabelMap: Record<string, string> = {
  "Level1": "Under $15K", "Level2": "$15–25K", "Level3": "$25–35K",
  "Level4": "$35–50K", "Level5": "$50–75K", "Level6": "$75–100K",
  "Level7": "$100–125K", "Level8": "$125–150K", "Level9": "Over $150K",
};

type SegSortKey = keyof Segment;

const S = {
  page: { padding: "32px 28px", maxWidth: 1100 } as React.CSSProperties,
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#22d3ee", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 24, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "24px", marginBottom: 20 } as React.CSSProperties,
  callout: { background: "#052e16", border: "1px solid #166534", borderLeft: "4px solid #22c55e", borderRadius: 10, padding: "18px 22px", marginBottom: 20 } as React.CSSProperties,
  calloutTitle: { fontSize: 13, fontWeight: 800, color: "#86efac", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  calloutBody: { fontSize: 15, color: "#bbf7d0", lineHeight: 1.7 },
  th: { padding: "12px 14px", fontWeight: 700, fontSize: 12, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #334155", background: "#0f172a", cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const },
  td: { padding: "13px 14px", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #263040" },
  tdBold: { padding: "13px 14px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderBottom: "1px solid #263040" },
  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#f1f5f9", marginBottom: 16, marginTop: 0 },
};

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <span style={{ color: "#475569", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "#38bdf8", marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

function PenetrationBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: "#0f172a", borderRadius: 4, height: 10, overflow: "hidden", minWidth: 80 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22c55e" : "#f59e0b", borderRadius: 4 }} />
      </div>
      <span style={{ fontWeight: 800, color: pct === 100 ? "#22c55e" : "#f59e0b", fontSize: 15, minWidth: 42 }}>{pct}%</span>
    </div>
  );
}

export default function DemographicSegments() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [segSort, setSegSort] = useState<{ key: SegSortKey; dir: "asc" | "desc" }>({ key: "soup_penetration_pct", dir: "desc" });
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [incomeFilter, setIncomeFilter] = useState("ALL");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/demographics"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed");
        setData(json as DemoData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#94a3b8", fontSize: 16 }}>Loading demographic signals…</div>;
  if (error) return <div style={{ padding: 40, color: "#f87171", fontSize: 16 }}>{error}</div>;
  if (!data) return null;

  const top = data.top_soup_buyer_segment;
  const allAges = [...new Set(data.all_segments.map(s => s.age_group))].sort();
  const allIncomes = [...new Set(data.all_segments.map(s => s.income_group))].sort();
  const periods = ["early", "mid", "late"];
  const periodLabels: Record<string, string> = { early: "Wks 1–34", mid: "Wks 35–68", late: "Wks 69–102" };

  const filteredSegs = data.all_segments
    .filter(s => (ageFilter === "ALL" || s.age_group === ageFilter) && (incomeFilter === "ALL" || s.income_group === incomeFilter))
    .sort((a, b) => {
      const av = a[segSort.key], bv = b[segSort.key];
      if (typeof av === "number" && typeof bv === "number") return segSort.dir === "asc" ? av - bv : bv - av;
      return segSort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const soupSpend = (p: string) => data.spend_trajectory.find(r => r.period === p && r.segment === "Soup Buyer")?.avg_spend ?? 0;
  const nonSoupSpend = (p: string) => data.spend_trajectory.find(r => r.period === p && r.segment === "Non-Soup Buyer")?.avg_spend ?? 0;

  const selectStyle: React.CSSProperties = { fontSize: 14, padding: "8px 14px", borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#e2e8f0", cursor: "pointer" };

  return (
    <div style={S.page}>
      <p style={S.eyebrow}>Signals</p>
      <h2 style={S.h2}>Demographic Segments</h2>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)", borderRadius: 14, padding: "28px 32px", marginBottom: 20, border: "1px solid #2563eb" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd", marginBottom: 10 }}>
          Highest-Value Soup Buyer Segment
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 18 }}>
          {ageLabelMap[top.age_group] ?? top.age_group} &nbsp;·&nbsp; {incomeLabelMap[top.income_group] ?? top.income_group}
        </div>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          {[
            ["Soup Penetration", `${top.soup_penetration_pct}%`, "#34d399"],
            ["Kids in Household", top.has_kids === "None/Unknown" ? "No / Unknown" : top.has_kids, "#e2e8f0"],
            ["Homeowner Status", top.homeowner, "#e2e8f0"],
          ].map(([label, val, color]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Callout */}
      <div style={S.callout}>
        <div style={S.calloutTitle}>Targeting Insight</div>
        <div style={S.calloutBody}>
          Multiple segments show <strong>100% soup penetration</strong> — every household buys soup.
          The <strong>45–54 age group</strong> at mid-income levels is the largest high-frequency segment.
          Loyalty coupons perform best in <strong>Frozen Grocery (30.6%)</strong> and <strong>Dairy Deli (30%)</strong> — ideal for soup + milk bundle promotions.
        </div>
      </div>

      {/* Segment explorer */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 0 }}>
            Soup Buyer Segments
            <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>— filter &amp; sort</span>
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={ageFilter} onChange={e => setAgeFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All Ages</option>
              {allAges.map(a => <option key={a} value={a}>{ageLabelMap[a] ?? a}</option>)}
            </select>
            <select value={incomeFilter} onChange={e => setIncomeFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All Incomes</option>
              {allIncomes.map(i => <option key={i} value={i}>{incomeLabelMap[i] ?? i}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          Showing <strong style={{ color: "#e2e8f0" }}>{filteredSegs.length}</strong> of {data.all_segments.length} segments
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {([
                  ["age_group", "Age Group"],
                  ["income_group", "Income"],
                  ["has_kids", "Has Kids"],
                  ["homeowner", "Homeowner"],
                  ["soup_buyers", "Soup Buyers"],
                  ["soup_penetration_pct", "Penetration"],
                ] as [SegSortKey, string][]).map(([k, label]) => (
                  <th key={k} style={S.th} onClick={() => setSegSort(prev => ({ key: k, dir: prev.key === k && prev.dir === "desc" ? "asc" : "desc" }))}>
                    {label}<SortIcon dir={segSort.key === k ? segSort.dir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSegs.map((seg, i) => {
                const rowId = `s${i}`;
                const hovered = hoveredRow === rowId;
                return (
                  <tr key={i} style={{ background: hovered ? "#243447" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={() => setHoveredRow(rowId)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={S.tdBold}>{ageLabelMap[seg.age_group] ?? seg.age_group}</td>
                    <td style={S.td}>{incomeLabelMap[seg.income_group] ?? seg.income_group}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{seg.has_kids === "None/Unknown" ? "—" : seg.has_kids}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{seg.homeowner}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{seg.soup_buyers}</td>
                    <td style={{ ...S.td, minWidth: 160 }}><PenetrationBar pct={seg.soup_penetration_pct} /></td>
                  </tr>
                );
              })}
              {filteredSegs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>No segments match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom row: spend trajectory + coupon */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <h3 style={S.sectionTitle}>Avg Spend Trajectory</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Period", "Soup Buyers", "Non-Soup", "Δ Gap"].map(h => (
                  <th key={h} style={{ ...S.th, cursor: "default" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => {
                const s = soupSpend(p), n = nonSoupSpend(p), gap = n - s;
                return (
                  <tr key={p}>
                    <td style={S.tdBold}>{periodLabels[p]}</td>
                    <td style={{ ...S.td, color: "#38bdf8", fontWeight: 700 }}>${s.toFixed(3)}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>${n.toFixed(3)}</td>
                    <td style={{ ...S.td, color: gap > 0 ? "#f87171" : "#34d399", fontWeight: 700 }}>
                      {gap > 0 ? "▲" : "▼"} ${Math.abs(gap).toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 14, lineHeight: 1.6 }}>
            Soup buyers are high-frequency, loyalty-oriented — non-soup buyers spend slightly more per visit but are less consistent.
          </div>
        </div>

        <div style={S.card}>
          <h3 style={S.sectionTitle}>Coupon Redemption by Dept</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.coupon_usage_by_dept.map(row => (
              <div key={row.DEPARTMENT}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{row.DEPARTMENT}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#38bdf8" }}>{row.coupon_pct}%</span>
                </div>
                <div style={{ background: "#0f172a", borderRadius: 6, height: 12, overflow: "hidden" }}>
                  <div style={{ width: `${row.coupon_pct}%`, height: "100%", background: "linear-gradient(90deg, #1d4ed8, #38bdf8)", borderRadius: 6, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {row.coupon_users.toLocaleString()} of {row.total_hh.toLocaleString()} households
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
