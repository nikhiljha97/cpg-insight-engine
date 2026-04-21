import React, { useEffect, useState } from "react";
import { apiUrl } from "../api";

// ─── Design tokens ───────────────────────────────────────────────────────────
const S = {
  // Layout
  page: {
    padding: "48px 32px 80px",
    maxWidth: 900,
    margin: "0 auto",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  } as React.CSSProperties,

  // Typography
  eyebrow: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#22d3ee",
    marginBottom: 10,
  } as React.CSSProperties,

  h2: {
    fontSize: 28,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 8px",
    lineHeight: 1.25,
  } as React.CSSProperties,

  h3: {
    fontSize: 20,
    fontWeight: 600,
    color: "#f1f5f9",
    margin: "0 0 10px",
    lineHeight: 1.3,
  } as React.CSSProperties,

  body: {
    fontSize: 16,
    lineHeight: 1.7,
    color: "#94a3b8",
    margin: 0,
  } as React.CSSProperties,

  bodyPrimary: {
    fontSize: 16,
    lineHeight: 1.7,
    color: "#f1f5f9",
    margin: 0,
  } as React.CSSProperties,

  // Cards
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "28px 32px",
    marginBottom: 20,
  } as React.CSSProperties,

  cardSmall: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "22px 24px",
  } as React.CSSProperties,

  // Section spacing
  section: {
    marginBottom: 56,
  } as React.CSSProperties,

  // Hero
  heroWrap: {
    marginBottom: 64,
    paddingBottom: 48,
    borderBottom: "1px solid #334155",
  } as React.CSSProperties,

  heroTitle: {
    fontSize: 48,
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 20px",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  } as React.CSSProperties,

  heroSubtitle: {
    fontSize: 18,
    lineHeight: 1.8,
    color: "#94a3b8",
    maxWidth: 720,
    margin: 0,
  } as React.CSSProperties,

  // Numbered step badge
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#22d3ee",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  stepRow: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 20,
  } as React.CSSProperties,

  stepContent: {
    paddingTop: 4,
  } as React.CSSProperties,

  stepTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: "#f1f5f9",
    marginBottom: 4,
  } as React.CSSProperties,

  stepDesc: {
    fontSize: 15,
    lineHeight: 1.65,
    color: "#94a3b8",
    margin: 0,
  } as React.CSSProperties,

  // 2-col grid
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  } as React.CSSProperties,

  // Accent chips
  accentCyan: { color: "#22d3ee", fontWeight: 600 } as React.CSSProperties,
  accentGreen: { color: "#34d399", fontWeight: 600 } as React.CSSProperties,
  accentYellow: { color: "#fbbf24", fontWeight: 600 } as React.CSSProperties,

  // Tech table / stack
  techCard: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "20px 22px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  } as React.CSSProperties,

  techLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.09em",
    textTransform: "uppercase" as const,
    color: "#22d3ee",
    marginBottom: 2,
  } as React.CSSProperties,

  techValue: {
    fontSize: 15,
    color: "#f1f5f9",
    lineHeight: 1.5,
  } as React.CSSProperties,

  techDesc: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  } as React.CSSProperties,

  // Divider
  divider: {
    border: "none",
    borderTop: "1px solid #334155",
    margin: "0 0 48px",
  } as React.CSSProperties,

  // Footer
  footer: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.7,
    paddingTop: 32,
    borderTop: "1px solid #1e293b",
    textAlign: "center" as const,
  } as React.CSSProperties,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StepProps {
  number: number;
  title: string;
  description: string;
  badgeColor?: string;
}

const Step: React.FC<StepProps> = ({
  number,
  title,
  description,
  badgeColor = "#22d3ee",
}) => (
  <div style={S.stepRow}>
    <div style={{ ...S.stepBadge, background: badgeColor }}>{number}</div>
    <div style={S.stepContent}>
      <div style={S.stepTitle}>{title}</div>
      <p style={S.stepDesc}>{description}</p>
    </div>
  </div>
);

interface DataCardProps {
  title: string;
  icon: string;
  description: string;
  accentColor: string;
}

const DataCard: React.FC<DataCardProps> = ({
  title,
  icon,
  description,
  accentColor,
}) => (
  <div style={S.cardSmall}>
    <div
      style={{
        fontSize: 28,
        marginBottom: 12,
        lineHeight: 1,
      }}
    >
      {icon}
    </div>
    <div
      style={{
        fontSize: 17,
        fontWeight: 600,
        color: accentColor,
        marginBottom: 8,
      }}
    >
      {title}
    </div>
    <p style={S.body}>{description}</p>
  </div>
);

interface TechItemProps {
  label: string;
  value: string;
  description?: string;
}

const TechItem: React.FC<TechItemProps> = ({ label, value, description }) => (
  <div style={S.techCard}>
    <div style={S.techLabel}>{label}</div>
    <div style={S.techValue}>{value}</div>
    {description && <div style={S.techDesc}>{description}</div>}
  </div>
);

type CatalogDataset = {
  id: string;
  name: string;
  role: string;
  kaggle_url: string;
  notes?: string;
};

const linkStyle: React.CSSProperties = {
  color: "#22d3ee",
  fontWeight: 600,
  textDecoration: "none",
};

/** Live list from /api/datasets + meta.datasets_used from unified_signal.json */
const DataSourcesSection: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogDataset[] | null>(null);
  const [datasetsUsed, setDatasetsUsed] = useState<string[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setCatalogError(null);
      setUnifiedError(null);

      const [catRes, uniRes] = await Promise.all([
        fetch(apiUrl("/api/datasets")),
        fetch(apiUrl("/api/signals/unified")),
      ]);

      if (!cancelled) {
        if (catRes.ok) {
          try {
            const body = (await catRes.json()) as { datasets?: CatalogDataset[] };
            setCatalog(Array.isArray(body.datasets) ? body.datasets : []);
          } catch {
            setCatalogError("Could not parse datasets catalog.");
            setCatalog([]);
          }
        } else {
          setCatalogError(catRes.status === 404 ? "Catalog file not on server." : `Catalog HTTP ${catRes.status}`);
          setCatalog([]);
        }

        if (uniRes.ok) {
          try {
            const uni = (await uniRes.json()) as {
              meta?: { datasets_used?: string[]; last_updated?: string };
            };
            const used = uni.meta?.datasets_used;
            setDatasetsUsed(Array.isArray(used) ? used : []);
            const lu = uni.meta?.last_updated;
            setLastUpdated(typeof lu === "string" ? lu : null);
          } catch {
            setUnifiedError("Could not parse unified signal.");
            setDatasetsUsed([]);
          }
        } else {
          setUnifiedError(
            uniRes.status === 404
              ? "unified_signal.json not deployed on this host."
              : `Unified signal HTTP ${uniRes.status}`
          );
          setDatasetsUsed([]);
        }
        setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={S.section}>
      <div style={S.eyebrow}>Provenance</div>
      <h2 style={S.h2}>Data sources &amp; Kaggle catalog</h2>
      <p style={{ ...S.body, marginBottom: 24 }}>
        Raw Dunnhumby CSVs are not shipped in this repo (they stay on your machine after you
        download from Kaggle). The dashboard reads the pre-built{" "}
        <span style={S.accentCyan}>unified_signal.json</span> from the server. Below: what this
        deployment&apos;s bundle contains, plus the curated Kaggle links used in the offline
        pipeline.
      </p>

      {loading && (
        <div style={S.card}>
          <p style={S.bodyPrimary}>Loading catalog…</p>
        </div>
      )}

      {!loading && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={S.card}>
            <h3 style={S.h3}>In this deployed build</h3>
            {unifiedError && (
              <p style={{ ...S.body, color: "#fbbf24", marginBottom: 12 }}>{unifiedError}</p>
            )}
            {!unifiedError && datasetsUsed && datasetsUsed.length > 0 ? (
              <>
                {lastUpdated && (
                  <p style={{ ...S.body, marginBottom: 16 }}>
                    <span style={S.accentGreen}>Last compiled:</span>{" "}
                    {new Date(lastUpdated).toLocaleString("en-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                <ul style={{ ...S.body, margin: 0, paddingLeft: 22, lineHeight: 1.85 }}>
                  {datasetsUsed.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              !unifiedError && (
                <p style={S.body}>
                  No <code style={{ color: "#94a3b8" }}>meta.datasets_used</code> entries returned.
                </p>
              )
            )}
          </div>

          <div style={S.card}>
            <h3 style={S.h3}>Kaggle source catalog</h3>
            {catalogError && (
              <p style={{ ...S.body, color: "#fbbf24", marginBottom: 12 }}>{catalogError}</p>
            )}
            {catalog && catalog.length > 0 ? (
              <div style={{ display: "grid", gap: 18 }}>
                {catalog.map((d, idx) => (
                  <div
                    key={d.id}
                    style={{
                      borderBottom: idx < catalog.length - 1 ? "1px solid #334155" : "none",
                      paddingBottom: idx < catalog.length - 1 ? 16 : 0,
                    }}
                  >
                    <div style={{ ...S.techLabel, marginBottom: 6 }}>{d.role}</div>
                    <div style={{ ...S.stepTitle, marginBottom: 6 }}>{d.name}</div>
                    {d.notes && <p style={{ ...S.body, marginBottom: 10 }}>{d.notes}</p>}
                    <a href={d.kaggle_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      View on Kaggle →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              !catalogError && <p style={S.body}>No catalog entries.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const About: React.FC = () => {
  return (
    <div style={S.page}>
      {/* ── 1. HERO ───────────────────────────────────────────────────────── */}
      <div style={S.heroWrap}>
        <div style={S.eyebrow}>CPG Retail Analytics Engine</div>
        <h1 style={S.heroTitle}>What is this?</h1>
        <p style={S.heroSubtitle}>
          A{" "}
          <span style={S.accentCyan}>weather-aware CPG retail analytics engine</span>{" "}
          built on{" "}
          <span style={S.accentGreen}>200M+ real retail transactions</span> from
          Dunnhumby's public research datasets. Designed for brand managers and
          retail media buyers navigating Canadian grocery markets — it
          automatically detects cold-weather demand windows and generates
          ready-to-present promotional pitches, backed by actual transaction
          data on promo lift, price elasticity, household demographics, and
          basket composition.
        </p>
      </div>

      {/* ── 2. THE BUSINESS PROBLEM ──────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.eyebrow}>Context</div>
        <h2 style={S.h2}>The Business Problem</h2>
        <div style={S.card}>
          <p style={{ ...S.body, marginBottom: 16 }}>
            Canadian CPG brands collectively spend{" "}
            <span style={S.accentYellow}>billions of dollars</span> on trade
            promotions every year — feature ads, display placements, temporary
            price reductions, loyalty coupons. The vast majority of those
            decisions are made on gut feel, past habit, or the loudest voice in
            the room.
          </p>
          <p style={{ ...S.body, marginBottom: 16 }}>
            Meanwhile, the data tells a consistent story:{" "}
            <span style={S.accentCyan}>
              cold, wet weather reliably spikes demand
            </span>{" "}
            for comfort categories — soup, hot beverages, pasta, baking
            ingredients. These demand windows are predictable days in advance
            from a free weather API.
          </p>
          <p style={S.body}>
            This engine closes that gap. It watches the 7-day forecast, detects
            qualifying cold-and-wet windows automatically, and produces a{" "}
            <span style={S.accentGreen}>
              data-backed retail activation proposal
            </span>{" "}
            within seconds — complete with weather hook, basket insight,
            activation plan, KPIs, and risk flags.
          </p>
        </div>
      </div>

      <hr style={S.divider} />

      {/* ── 3. HOW THE WEATHER TRIGGER WORKS ─────────────────────────────── */}
      <div style={S.section}>
        <div style={S.eyebrow}>Mechanism</div>
        <h2 style={S.h2}>How the Weather Trigger Works</h2>
        <div style={S.card}>
          <Step
            number={1}
            title="Select any Canadian city"
            description="Choose from the city dropdown on the Dashboard tab. Major metros (Toronto, Vancouver, Calgary, Montreal, etc.) and regional markets are supported."
          />
          <Step
            number={2}
            title="Live 7-day forecast fetched from Open-Meteo"
            description="The engine calls the Open-Meteo free API — no API key required. It pulls daily max/min temperature and precipitation probability for each of the next 7 days."
          />
          <Step
            number={3}
            title="Engine checks days 2–4 for trigger conditions"
            description="If the average temperature across the 3-day window falls below your threshold AND at least one of those days has a precipitation probability above 40%, the trigger fires — displaying a red TRIGGERED badge."
          />
          <Step
            number={4}
            title="Temperature slider lets you simulate any threshold"
            description='The default trigger is 10°C, but you can drag the slider to any value. Useful for scenario-testing: "What if we only activate when it drops below 5°C?" or "Would 14°C catch shoulder-season windows?"'
          />
          <Step
            number={5}
            title="Click Generate Pitch → full retail activation proposal in seconds"
            description="When the trigger is active, the Generate Pitch button calls the Groq LLM (llama-3.3-70b-versatile). It receives the weather data, city, threshold, and pre-computed data signals, then writes a complete brand manager pitch document — weather hook, promo strategy, KPIs, and risk section included."
          />
        </div>
      </div>

      <hr style={S.divider} />

      {/* ── 4. WHAT THE DATA SIGNALS MEAN ────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.eyebrow}>Data Signals</div>
        <h2 style={S.h2}>What the Data Signals Mean</h2>
        <p style={{ ...S.body, marginBottom: 24 }}>
          Every metric in this dashboard is computed from real transaction
          records — not synthetic data, not industry averages. Here's what each
          signal tells you.
        </p>
        <div style={S.grid2}>
          <DataCard
            icon="📊"
            title="Promo Attribution"
            accentColor="#22d3ee"
            description="Which promotional tactic — display, feature mailer, or temporary price reduction (TPR) — drives the most volume lift by store tier. Tells you where to spend your trade budget for maximum ROI."
          />
          <DataCard
            icon="📉"
            title="Price Elasticity"
            accentColor="#34d399"
            description="How sensitive each category is to price changes. A highly elastic category responds sharply to a 10% price cut; an inelastic one barely moves. This guides how deep a promotional discount actually needs to go."
          />
          <DataCard
            icon="👥"
            title="Demographics"
            accentColor="#fbbf24"
            description="Which household segments — by income band, family size, life stage — have the highest penetration and spend in soup and comfort food categories. Guides who to target with loyalty coupons and personalized offers."
          />
          <DataCard
            icon="🛒"
            title="Basket Analysis"
            accentColor="#a78bfa"
            description="What products are most commonly bought together with soup in the same transaction. Reveals natural bundling opportunities and adjacency placement strategies — e.g., crackers, bread, and canned goods frequently co-appear."
          />
        </div>
      </div>

      <hr style={S.divider} />

      <DataSourcesSection />

      <hr style={S.divider} />

      {/* ── 5. HOW TO USE IT ─────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.eyebrow}>Walkthrough</div>
        <h2 style={S.h2}>How to Use It</h2>
        <p style={{ ...S.body, marginBottom: 28 }}>
          A step-by-step guide for a VP or brand manager picking this up for
          the first time.
        </p>
        <div style={S.card}>
          <Step
            number={1}
            title="Pick your city from the dropdown on the Dashboard"
            description="This sets the geography for both the weather forecast and the context in the AI-generated pitch."
            badgeColor="#22d3ee"
          />
          <Step
            number={2}
            title="Move the temperature slider to set your trigger sensitivity"
            description="Start at the default (10°C). Lower it if you only want to activate on true cold snaps; raise it for earlier, more frequent triggers."
            badgeColor="#22d3ee"
          />
          <Step
            number={3}
            title="If the trigger fires (red TRIGGERED badge), hit Generate Pitch"
            description="The badge means the upcoming 3-day window meets your cold-and-wet criteria. Green means conditions don't yet warrant an activation."
            badgeColor="#34d399"
          />
          <Step
            number={4}
            title="Review the AI-written pitch"
            description="The generated document includes a weather hook (why act now), basket insights (what shoppers buy together), a full activation plan, KPIs to track, and a risk/mitigation section."
            badgeColor="#34d399"
          />
          <Step
            number={5}
            title="Copy and paste into your next brand manager meeting deck"
            description="The pitch is formatted as a narrative proposal. It's written to be dropped directly into a PowerPoint or Google Slides speaker notes section."
            badgeColor="#34d399"
          />
          <Step
            number={6}
            title="Use Promo Attribution to decide WHICH tactic to recommend"
            description="Navigate to the Promo Attribution tab. Filter by your category (e.g., Soup/Broth) and check which tactic — display, mailer, or TPR — shows the highest lift index for your store tier."
            badgeColor="#fbbf24"
          />
          <Step
            number={7}
            title="Use Price Elasticity to set the right promotional price point"
            description="Check the elasticity coefficient for your category. High elasticity means a modest discount drives big volume. Low elasticity means you need a deeper cut — or should pair with a display rather than pure price."
            badgeColor="#fbbf24"
          />
          <Step
            number={8}
            title="Use Demographics to identify WHICH households to target with loyalty coupons"
            description="Find the household segments with highest soup penetration. These are your highest-probability responders for a loyalty app coupon or personalized email offer — reducing wasted trade spend."
            badgeColor="#a78bfa"
          />
        </div>
      </div>

      <hr style={S.divider} />

      {/* ── 6. TECH STACK ────────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.eyebrow}>Under the Hood</div>
        <h2 style={S.h2}>The Tech Stack</h2>
        <p style={{ ...S.body, marginBottom: 28 }}>
          Every component in the stack is either open-source, free-tier, or
          built on publicly available research data.
        </p>
        <div style={S.grid2}>
          <TechItem
            label="Transaction Data"
            value="Dunnhumby Research Datasets"
            description="Complete Journey (2.6M tx) · Carbo-Loading (5.2M tx) · Breakfast at the Frat (525K rows) · Let's Get Sort-of-Real (209M+ tx)"
          />
          <TechItem
            label="Database"
            value="DuckDB"
            description="In-process analytical SQL — no server required, sub-second queries on 200M+ rows"
          />
          <TechItem
            label="Weather API"
            value="Open-Meteo"
            description="Free, no API key required. 7-day hourly forecast with temperature and precipitation probability"
          />
          <TechItem
            label="Traffic Data"
            value="Ontario 511 API"
            description="Free, no API key required. Road and highway condition alerts for Ontario"
          />
          <TechItem
            label="Retail Index"
            value="Statistics Canada WDS"
            description="Free. Ontario retail sales index for macro demand context"
          />
          <TechItem
            label="AI / LLM"
            value="Groq — llama-3.3-70b-versatile"
            description="Ultra-low latency inference. Full pitch document generated in under 3 seconds"
          />
          <TechItem
            label="Frontend"
            value="React + Vite + TypeScript"
            description="Component-based UI with strong type safety throughout"
          />
          <TechItem
            label="Backend"
            value="Express + Node.js"
            description="Lightweight REST API layer serving DuckDB query results and proxying LLM calls"
          />
          <TechItem
            label="Hosting"
            value="Render (free tier)"
            description="Both frontend and backend deployed on Render's free tier — cold starts possible after inactivity"
          />
          <TechItem
            label="Scheduling"
            value="GitHub Actions"
            description="Weekday 8AM ET — keeps the Render service warm and refreshes any cached data signals"
          />
        </div>
      </div>

      {/* ── 7. FOOTER NOTE ───────────────────────────────────────────────── */}
      <footer style={S.footer}>
        Built as a portfolio demonstration of retail media analytics. All
        transaction data is sourced from publicly available Dunnhumby research
        datasets. No PII is used or stored.
      </footer>
    </div>
  );
};

export default About;
