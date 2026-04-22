import { jsPDF } from "jspdf";
import type { GatheredInsights } from "./insightsPdfBundle";

function clipJson(label: string, value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(value, null, 2);
    const body = s.length <= maxChars ? s : `${s.slice(0, maxChars)}\n… [truncated ${s.length - maxChars} chars]`;
    return `${label}\n${body}`;
  } catch {
    return `${label}\n[Could not serialize]`;
  }
}

function addParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  margin: number,
  pageW: number,
  pageH: number,
  fontSize = 10
): number {
  doc.setFontSize(fontSize);
  const maxW = pageW - margin * 2;
  const lines = doc.splitTextToSize(text, maxW);
  const lh = Math.round(fontSize * 1.35);
  for (const line of lines) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lh;
  }
  return y + 8;
}

function sectionTitle(doc: jsPDF, title: string, y: number, margin: number, pageH: number): number {
  if (y > pageH - 72) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  return y + 20;
}

export function buildInsightsPdfBlob(data: GatheredInsights): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(18);
  doc.text("CPG Insight Engine — consolidated insights", margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const scopeHuman =
    data.scope === "all"
      ? "All categories (basket + Ontario retail blocks repeat per food category)."
      : data.scope;
  y = addParagraph(
    doc,
    `Generated (UTC): ${data.generatedAt}\nCity: ${data.city}\nWeather thresholds: cold ${data.threshold}°C · hot ${data.hotThreshold}°C\nFood category scope: ${scopeHuman}`,
    y,
    margin,
    pageW,
    pageH,
    10
  );

  y = sectionTitle(doc, "Unified signal bundle (excerpt)", y, margin, pageH);
  y = addParagraph(doc, clipJson("unified_signal.json", data.unified, 6500), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Macro strip (listings + CPI)", y, margin, pageH);
  y = addParagraph(doc, clipJson("macro_strip", data.macroStrip, 4500), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Basket insights + Ontario retail (per category in scope)", y, margin, pageH);
  for (const cat of Object.keys(data.baskets)) {
    y = sectionTitle(doc, `Category — ${cat}`, y, margin, pageH);
    y = addParagraph(doc, clipJson("Basket insights", data.baskets[cat], 3500), y, margin, pageW, pageH, 9);
    y = addParagraph(doc, clipJson("Ontario retail (StatCan)", data.ontarioRetail[cat], 3500), y, margin, pageW, pageH, 9);
  }

  y = sectionTitle(doc, "Promo attribution (from unified)", y, margin, pageH);
  y = addParagraph(doc, clipJson("promo", data.promo, 4000), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Price elasticity (from unified)", y, margin, pageH);
  y = addParagraph(doc, clipJson("price_elasticity", data.priceElasticity, 4000), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Demographics (from unified)", y, margin, pageH);
  y = addParagraph(doc, clipJson("demographics", data.demographics, 4000), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Pitch history (SQLite)", y, margin, pageH);
  y = addParagraph(doc, clipJson("pitches", data.pitchHistory, 5000), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "GTA traffic (511 proxy)", y, margin, pageH);
  y = addParagraph(doc, clipJson("traffic", data.traffic, 2500), y, margin, pageW, pageH, 9);

  y = sectionTitle(doc, "Notes", y, margin, pageH);
  y = addParagraph(
    doc,
    "Figures are snapshots from the live API at export time. StatCan Ontario retail uses published NAICS rows; some dashboard categories intentionally share the same vector where Statistics Canada does not split further. NLQ chat responses are not embedded in this PDF.",
    y,
    margin,
    pageW,
    pageH,
    9
  );

  return doc.output("blob");
}

export function insightsPdfFilename(scope: GatheredInsights["scope"]): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const slug = scope === "all" ? "all-categories" : scope.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `cpg-insights-${slug}-${stamp}.pdf`;
}
