import React from "react";

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
          automatically detects cold-wet and hot-dry demand windows and generates
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
            ingredients — while{" "}
            <span style={S.accentYellow}>
              hot, dry stretches tilt baskets
            </span>{" "}
            toward beverages, ice cream, BBQ, and outdoor snacking. These windows
            are predictable days in advance from a free weather API.
          </p>
          <p style={S.body}>
            This engine closes that gap. It watches the 7-day forecast, detects
            qualifying cold-wet and hot-dry windows automatically, and produces a{" "}
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
            description="The engine calls the Open-Meteo free API — no API key required. It pulls daily max/min temperature, daily precipitation totals, WMO weather codes, and labels for each of the next 7 days."
          />
          <Step
            number={3}
            title="Engine checks the next 3 forecast days (days 2–4) for lane rules"
            description="Cold lane: average temperature is below your cold comfort slider AND at least one of those days has a wet-type WMO code (drizzle, rain, snow, thunderstorm families). Hot lane: average is above your hot summer slider AND none of those days are wet-type — a dry heat window. Either lane can light the activation badge."
          />
          <Step
            number={4}
            title="Two sliders: cold comfort and hot summer"
            description="Defaults are tuned for grocery context (cold near 10°C, hot near 26°C). Drag either slider to stress-test how often you would activate comfort promos versus summer/bev/BBQ plays."
          />
          <Step
            number={5}
            title="Click Generate Pitch → full retail activation proposal in seconds"
            description="When a lane is active, Generate Pitch calls the Groq LLM (llama-3.3-70b-versatile). It receives the forecast, city, both thresholds, lane flags, and pre-computed data signals, then writes a complete brand manager pitch — weather hook, promo strategy, KPIs, and risk section included."
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
            title="Move the cold and hot sliders to set each lane's sensitivity"
            description="Cold controls comfort activations (needs wet-type codes in the 3-day slice). Hot controls summer-style activations (needs a dry window). Adjust both to match how aggressively your brand chases weather-tied media."
            badgeColor="#22d3ee"
          />
          <Step
            number={3}
            title="If a lane fires (activation badge), hit Generate Pitch"
            description="The badge means the upcoming 3-day slice hit either the cold-wet lane or the hot-dry lane. If neither lane is on, the engine stays in monitoring mode until the forecast shifts."
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
          <Step
            number={9}
            title="Use Query your data on the Dashboard for an interactive NLQ copilot"
            description="Multi-turn chat over the unified signal (Groq). Ask follow-ups; the model stays grounded in the bundled JSON and can attach simple charts when useful. Requires GROQ_API_KEY on the server."
            badgeColor="#22d3ee"
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
            description="Pitch generation plus an interactive Dashboard copilot (NLQ) grounded in the unified signal — JSON-mode replies with optional charts"
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
            description="Every 4 hours UTC the workflow wakes Render, clears in-memory API caches, and pre-warms StatCan (total + all demand categories), 511 traffic, and Open-Meteo weather for key cities. Unified bundle JSON still refreshes on its own data pipeline schedule."
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
