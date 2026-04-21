// CategorySignals.tsx
// Weather-driven category signals panel for the retail promotions dashboard.
// Usage: <CategorySignals avgTemp={12} threshold={10} />
// Place in src/pages/ — imports from ../weatherCategories

import React, { useMemo } from "react";
import { getProfileForTemp, CategorySignal, WeatherProfile } from "../weatherCategories";

// ─── Prop Types ──────────────────────────────────────────────────────────────

interface CategorySignalsProps {
  /** Current average temperature in °C */
  avgTemp: number;
  /** Cold comfort cut-off °C (informational) */
  threshold: number;
  /** Hot summer cut-off °C */
  hotThreshold: number;
  /** Cold-wet activation lane from Dashboard */
  coldPromoActive: boolean;
  /** Hot-dry activation lane from Dashboard */
  hotPromoActive: boolean;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Elasticity badge: High = red, Medium = amber, Low = green */
const ElasticityBadge: React.FC<{ elasticity: CategorySignal["elasticity"] }> = ({ elasticity }) => {
  const styles: Record<CategorySignal["elasticity"], React.CSSProperties> = {
    High: { backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
    Medium: { backgroundColor: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" },
    Low: { backgroundColor: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" },
  };
  return (
    <span style={{
      ...styles[elasticity],
      fontSize: "0.65rem",
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase" as const,
      padding: "2px 7px",
      borderRadius: "4px",
      whiteSpace: "nowrap" as const,
    }}>
      {elasticity} Elasticity
    </span>
  );
};

/** Small tactic pill */
const TacticBadge: React.FC<{ label: string }> = ({ label }) => (
  <span style={{
    backgroundColor: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.2)",
    color: "#94a3b8",
    fontSize: "0.65rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    padding: "2px 7px",
    borderRadius: "4px",
    whiteSpace: "nowrap" as const,
  }}>
    {label}
  </span>
);

/** Department badge */
const DeptBadge: React.FC<{ dept: string }> = ({ dept }) => (
  <span style={{
    backgroundColor: "rgba(100,116,139,0.18)",
    color: "#94a3b8",
    fontSize: "0.6rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    padding: "2px 8px",
    borderRadius: "3px",
    border: "1px solid rgba(100,116,139,0.25)",
  }}>
    {dept}
  </span>
);

/** LOW DEMAND warning badge (for negative uplift) */
const LowDemandBadge: React.FC = () => (
  <span style={{
    backgroundColor: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    fontSize: "0.6rem",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "3px 8px",
    borderRadius: "4px",
  }}>
    ⚠ LOW DEMAND
  </span>
);

/** Individual category signal card */
const SignalCard: React.FC<{ signal: CategorySignal }> = ({ signal }) => {
  const isNegative = signal.demandUplift < 0;
  const isZero = signal.demandUplift === 0;

  const upliftColor = isNegative ? "#f87171" : isZero ? "#94a3b8" : "#4ade80";
  const upliftSign = isNegative ? "" : isZero ? "" : "+";

  return (
    <div
      style={{
        backgroundColor: isNegative ? "rgba(30,41,59,0.6)" : "#1e293b",
        border: `1px solid ${isNegative ? "rgba(239,68,68,0.25)" : "#334155"}`,
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        opacity: isNegative ? 0.75 : 1,
        transition: "border-color 0.2s ease, opacity 0.2s ease",
        position: "relative" as const,
        overflow: "hidden" as const,
      }}
    >
      {/* Left accent bar using the signal's color */}
      <div style={{
        position: "absolute" as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: "3px",
        backgroundColor: isNegative ? "#ef4444" : signal.color,
        borderRadius: "12px 0 0 12px",
      }} />

      {/* Header row: category name + department + uplift */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0,
            fontSize: "1.05rem",
            fontWeight: 700,
            color: isNegative ? "#94a3b8" : signal.color,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}>
            {signal.category}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" as const }}>
            <DeptBadge dept={signal.department} />
            {isNegative && <LowDemandBadge />}
          </div>
        </div>

        {/* Demand uplift number */}
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: upliftColor,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}>
            {upliftSign}{signal.demandUplift}%
          </div>
          <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: "2px" }}>
            vs baseline
          </div>
        </div>
      </div>

      {/* Trigger reason */}
      <p style={{
        margin: 0,
        fontSize: "0.775rem",
        color: "#94a3b8",
        lineHeight: 1.5,
        fontStyle: "italic",
      }}>
        {signal.triggerReason}
      </p>

      {/* Co-purchase companions */}
      {signal.companions.length > 0 && (
        <div>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: "6px" }}>
            Basket companions
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "5px" }}>
            {signal.companions.map((c) => (
              <span key={c.product} style={{
                fontSize: "0.68rem",
                color: "#cbd5e1",
                backgroundColor: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: "4px",
                padding: "2px 7px",
                whiteSpace: "nowrap" as const,
              }}>
                {c.product} <span style={{ color: "#4ade80", fontWeight: 700 }}>{c.coRate}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Separator */}
      <div style={{ height: "1px", backgroundColor: "#334155" }} />

      {/* Bottom row: tactics + elasticity */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "5px", flex: 1 }}>
          {signal.tactics.map((t) => (
            <TacticBadge key={t} label={t} />
          ))}
        </div>
        <ElasticityBadge elasticity={signal.elasticity} />
      </div>
    </div>
  );
};

// ─── Profile Header ───────────────────────────────────────────────────────────

const ProfileHeader: React.FC<{
  profile: WeatherProfile;
  avgTemp: number;
  threshold: number;
  hotThreshold: number;
  coldPromoActive: boolean;
  hotPromoActive: boolean;
}> = ({ profile, avgTemp, threshold, hotThreshold, coldPromoActive, hotPromoActive }) => {
  const isBelowThreshold = avgTemp < threshold;
  const isAboveHot = avgTemp > hotThreshold;

  return (
    <div style={{
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "14px",
      padding: "20px 24px",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      flexWrap: "wrap" as const,
    }}>
      {/* Icon + label + temp range */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
        <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{profile.icon}</span>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}>
              {profile.label}
            </span>
            <span style={{
              fontSize: "0.8rem",
              color: "#64748b",
              fontWeight: 500,
            }}>
              {profile.tempRange}
            </span>
          </div>
          <div style={{
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap" as const,
          }}>
            <span style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#f1f5f9",
            }}>
              {avgTemp >= 0 ? "+" : ""}{avgTemp}°C
            </span>
            {coldPromoActive && (
              <span
                style={{
                  backgroundColor: "rgba(34,211,238,0.15)",
                  border: "1px solid rgba(34,211,238,0.35)",
                  color: "#22d3ee",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  padding: "2px 7px",
                  borderRadius: "4px",
                }}
              >
                Cold lane active
              </span>
            )}
            {hotPromoActive && (
              <span
                style={{
                  backgroundColor: "rgba(251,146,60,0.15)",
                  border: "1px solid rgba(251,146,60,0.35)",
                  color: "#fb923c",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  padding: "2px 7px",
                  borderRadius: "4px",
                }}
              >
                Hot lane active
              </span>
            )}
            {!coldPromoActive && !hotPromoActive && isBelowThreshold && (
              <span
                style={{
                  backgroundColor: "rgba(59,130,246,0.15)",
                  border: "1px solid rgba(59,130,246,0.35)",
                  color: "#60a5fa",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  padding: "2px 7px",
                  borderRadius: "4px",
                }}
              >
                Below {threshold}°C (not wet enough for cold lane)
              </span>
            )}
            {!coldPromoActive && !hotPromoActive && isAboveHot && (
              <span
                style={{
                  backgroundColor: "rgba(251,146,60,0.12)",
                  border: "1px solid rgba(251,146,60,0.3)",
                  color: "#fdba74",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  padding: "2px 7px",
                  borderRadius: "4px",
                }}
              >
                Above {hotThreshold}°C (wet days block hot lane)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "48px", backgroundColor: "#334155", flexShrink: 0, display: "flex" as const }} />

      {/* Description + category count */}
      <div style={{ flex: 1, minWidth: "180px" }}>
        <p style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "#94a3b8",
          lineHeight: 1.55,
        }}>
          {profile.description}
        </p>
      </div>

      {/* Signal count pill */}
      <div style={{
        flexShrink: 0,
        backgroundColor: "rgba(99,102,241,0.12)",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: "8px",
        padding: "10px 16px",
        textAlign: "center" as const,
      }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#818cf8", lineHeight: 1 }}>
          {profile.categories.length}
        </div>
        <div style={{ fontSize: "0.6rem", color: "#6366f1", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, marginTop: "2px" }}>
          Active signals
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CategorySignals: React.FC<CategorySignalsProps> = ({
  avgTemp,
  threshold,
  hotThreshold,
  coldPromoActive,
  hotPromoActive,
}) => {
  const profile: WeatherProfile = useMemo(() => getProfileForTemp(avgTemp), [avgTemp]);

  return (
    <section
      style={{
        backgroundColor: "#0f172a",
        borderRadius: "16px",
        padding: "24px",
        fontFamily:
          "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
      aria-label={`Weather-driven category signals: ${profile.label}`}
    >
      {/* Section title */}
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "8px" }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.01em",
          }}>
            Weather-Driven Category Signals
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#64748b" }}>
            Demand uplift and promo tactics by temperature band
          </p>
        </div>
        <span style={{
          fontSize: "0.65rem",
          color: "#475569",
          fontWeight: 500,
          padding: "3px 8px",
          border: "1px solid #1e293b",
          borderRadius: "4px",
        }}>
          Live • {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Profile header */}
      <ProfileHeader
        profile={profile}
        avgTemp={avgTemp}
        threshold={threshold}
        hotThreshold={hotThreshold}
        coldPromoActive={coldPromoActive}
        hotPromoActive={hotPromoActive}
      />

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
          gap: "14px",
        }}
      >
        {profile.categories.map((signal) => (
          <SignalCard key={signal.category} signal={signal} />
        ))}
      </div>

      {/* Footer note */}
      <p style={{
        margin: "16px 0 0",
        fontSize: "0.65rem",
        color: "#334155",
        textAlign: "center" as const,
        letterSpacing: "0.03em",
      }}>
        Demand uplift figures vs summer baseline. Co-purchase rates from transaction-level basket analysis.
        Elasticity coefficients: Value stores unless stated.
      </p>
    </section>
  );
};

export default CategorySignals;
