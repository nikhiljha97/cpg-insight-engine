import { useMemo, useState, type CSSProperties } from "react";

type EsgLink = { label: string; href: string; blurb: string };

const EXTERNAL: EsgLink[] = [
  {
    label: "Environment and Climate Change Canada",
    href: "https://www.canada.ca/en/environment-climate-change.html",
    blurb: "Federal climate programs, reporting, and regulatory direction relevant to Canadian operations.",
  },
  {
    label: "Statistics Canada — Environment",
    href: "https://www.statcan.gc.ca/en/subjects-start/environment",
    blurb: "Official environmental and natural-resource statistics to contextualize footprint narratives.",
  },
  {
    label: "Natural Resources Canada — Energy",
    href: "https://www.nrcan.gc.ca/energy",
    blurb: "Energy efficiency, clean fuels, and grid-related guidance for Canadian facilities.",
  },
  {
    label: "GHG Protocol (WRI/WBCSD)",
    href: "https://ghgprotocol.org/",
    blurb: "Global standard for corporate greenhouse-gas accounting — useful when aligning retail scope 1–3 claims.",
  },
  {
    label: "Ellen MacArthur Foundation — Plastics",
    href: "https://ellenmacarthurfoundation.org/topics/plastics/overview",
    blurb: "Circular economy framing for packaging and plastics reduction roadmaps.",
  },
  {
    label: "Retail Council of Canada",
    href: "https://www.retailcouncil.org/",
    blurb: "Industry advocacy and retail-focused policy context (check their sustainability resources).",
  },
];

/** Illustrative factors — not audited for your province or tariff year. Replace with utility-specific data for board reporting. */
function estimateRetailFootprint(input: {
  storeKwh: number;
  deliveryDieselLitres: number;
  bagsReplaced: number;
  foodWasteTonnes: number;
}): { co2eKg: number; breakdown: { label: string; kg: number }[] } {
  const gridKgPerKwh = 0.04;
  const dieselKgPerL = 2.68;
  const bagKgCo2e = 0.06;
  const wasteKgPerTonneFood = 2500;

  const elec = Math.max(0, input.storeKwh) * gridKgPerKwh;
  const road = Math.max(0, input.deliveryDieselLitres) * dieselKgPerL;
  const bags = Math.max(0, input.bagsReplaced) * bagKgCo2e;
  const waste = Math.max(0, input.foodWasteTonnes) * wasteKgPerTonneFood;
  const co2eKg = elec + road + bags + waste;
  return {
    co2eKg,
    breakdown: [
      { label: "Store electricity (illustrative grid factor)", kg: elec },
      { label: "Diesel delivery (tank-to-wheel, rough)", kg: road },
      { label: "Single-use bag avoidance (order-of-magnitude)", kg: bags },
      { label: "Food waste landfill proxy (very rough)", kg: waste },
    ],
  };
}

const S = {
  page: { padding: "32px 28px", maxWidth: 1100 } as React.CSSProperties,
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#4ade80", marginBottom: 4 },
  h2: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 12, marginTop: 0 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "22px 24px", marginBottom: 20 } as React.CSSProperties,
};

export default function EsgInsights() {
  const [kwh, setKwh] = useState("120000");
  const [dieselL, setDieselL] = useState("1800");
  const [bags, setBags] = useState("50000");
  const [wasteT, setWasteT] = useState("2.5");

  const result = useMemo(() => {
    return estimateRetailFootprint({
      storeKwh: Number(kwh) || 0,
      deliveryDieselLitres: Number(dieselL) || 0,
      bagsReplaced: Number(bags) || 0,
      foodWasteTonnes: Number(wasteT) || 0,
    });
  }, [bags, dieselL, kwh, wasteT]);

  return (
    <div style={S.page} className="page">
      <p style={S.eyebrow}>Sustainability & ESG</p>
      <h2 style={S.h2}>ESG insights</h2>
      <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
        Retailers and CPG brands increasingly pair <strong style={{ color: "#e2e8f0" }}>sales analytics</strong> with
        carbon, packaging, and waste narratives for boards and ESG-linked finance. This tab curates{" "}
        <strong style={{ color: "#e2e8f0" }}>external authorities</strong> and offers a{" "}
        <strong style={{ color: "#e2e8f0" }}>back-of-envelope calculator</strong> so teams can stress-test orders of
        magnitude before engaging sustainability consultants or utility-grade metering.
      </p>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>Authoritative links</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {EXTERNAL.map((x) => (
            <a
              key={x.href}
              href={x.href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: "#0f172a",
                textDecoration: "none",
                color: "#7dd3fc",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{x.label}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{x.blurb}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>{x.href}</div>
            </a>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>Retail footprint sketch (monthly)</h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Illustrative CO₂e-style blend (kg CO₂e equivalent per month) from store electricity (grid factor placeholder),
          diesel litres for last-mile / DC legs, plastic bag avoidance counts, and food-waste tonnes sent to landfill
          proxy. <strong style={{ color: "#fca5a5" }}>Not</strong> audit-ready — replace factors with your province,
          fleet telematics, and waste-diversion audits.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
            Store electricity (kWh / month)
            <input value={kwh} onChange={(e) => setKwh(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
            Diesel burned (L / month)
            <input value={dieselL} onChange={(e) => setDieselL(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
            Bags replaced / avoided (# / month)
            <input value={bags} onChange={(e) => setBags(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94a3b8" }}>
            Food waste to landfill (tonnes / month)
            <input value={wasteT} onChange={(e) => setWasteT(e.target.value)} style={inputStyle} />
          </label>
        </div>
        <div
          style={{
            marginTop: 22,
            padding: "16px 18px",
            borderRadius: 10,
            background: "#052e16",
            border: "1px solid #166534",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#bbf7d0" }}>
            Combined illustrative footprint:{" "}
            <strong style={{ fontSize: 22, color: "#4ade80" }}>{result.co2eKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>{" "}
            kg CO₂e-equivalent / month
          </p>
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13, color: "#86efac", lineHeight: 1.55 }}>
            {result.breakdown.map((b) => (
              <li key={b.label}>
                {b.label}: <strong>{b.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> kg
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 15,
};
