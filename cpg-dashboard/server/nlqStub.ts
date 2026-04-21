/**
 * Keyword-based NLQ stub: fixed intents + simple chart payloads (no LLM).
 */

import { buildMacroStrip } from "./macroStrip.js";

export type NlqBarLineChart = {
  type: "bar" | "line";
  labels: string[];
  values: number[];
  /** e.g. "$" or "M$" */
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
};

export type NlqCardChart = {
  type: "card";
  headline: string;
  detail?: string;
};

export type NlqChart = NlqBarLineChart | NlqCardChart;

export type NlqStubResponse = {
  intent: string;
  title: string;
  explanation: string;
  chart: NlqChart | null;
  suggestions: string[];
};

type NlqContext = {
  unified: Record<string, unknown> | null;
  /** Last N Ontario retail points in millions CAD (StatCan trail) */
  ontarioRetailSeries: Array<{ period: string; value: number }>;
};

const DEFAULT_SUGGESTIONS = [
  "Show grocery mean list price by month",
  "What is the Toronto CPI?",
  "Ontario retail sales trend",
  "Top soup basket companions",
];

function readSoupCompanions(
  unified: Record<string, unknown> | null
): Array<{ product: string; pct: number }> {
  const basket = unified?.basket_analysis as Record<string, unknown> | undefined;
  const rows =
    (basket?.soup_companions as Array<{ product?: string; pct_of_soup_baskets?: number }> | undefined) ?? [];
  return rows
    .map((r) => ({ product: String(r.product ?? ""), pct: Number(r.pct_of_soup_baskets ?? 0) }))
    .filter((r) => r.product && Number.isFinite(r.pct));
}

function ymLabel(period: string): string {
  try {
    const d = new Date(period.length === 7 ? `${period}-01T12:00:00Z` : `${period}T12:00:00Z`);
    return d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return period;
  }
}

export function runNlqStub(query: string, ctx: NlqContext): NlqStubResponse {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      intent: "empty",
      title: "Query your data",
      explanation:
        "Type a question below. This beta bar uses keyword routing over unified_signal and StatCan trail data — no external LLM.",
      chart: null,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const strip = buildMacroStrip(ctx.unified);

  if (/\b(soup|companion|co-?purchase|basket with soup|what.*bought with soup)\b/.test(q)) {
    const companions = readSoupCompanions(ctx.unified).slice(0, 8);
    if (!companions.length) {
      return {
        intent: "soup_companions",
        title: "Soup basket companions",
        explanation: "No soup companion rows were found in unified_signal.json.",
        chart: null,
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
    return {
      intent: "soup_companions",
      title: "Top soup basket companions",
      explanation:
        "Share of soup baskets containing each product (Dunnhumby-style unified signal). Use for cross-merch and display adjacency.",
      chart: {
        type: "bar",
        labels: companions.map((c) => c.product),
        values: companions.map((c) => c.pct),
        valueSuffix: "%",
        decimals: 1,
      },
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/\b(ontario|statcan|provincial).*\b(retail|sales)\b|\b(retail|sales).*\bontario\b/.test(q)) {
    const pts = ctx.ontarioRetailSeries;
    if (!pts.length) {
      return {
        intent: "ontario_retail",
        title: "Ontario retail sales",
        explanation: "No Ontario retail series was available for the chart stub.",
        chart: null,
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
    return {
      intent: "ontario_retail",
      title: "Ontario total retail (seasonally adjusted)",
      explanation:
        "Trailing months from the dashboard StatCan trail (millions CAD). Pair with weather lanes to time activations.",
      chart: {
        type: "line",
        labels: pts.map((p) => ymLabel(p.period)),
        values: pts.map((p) => p.value),
        decimals: 0,
      },
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/\bcpi\b|\binflation\b|\bconsumer price\b/.test(q)) {
    if (!strip.cpi) {
      return {
        intent: "cpi",
        title: "CPI (CMA)",
        explanation: "No CPI column was found under retail_analytics.macro_cma in unified_signal.json.",
        chart: null,
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
    const city = strip.cpi.city ?? "CMA";
    return {
      intent: "cpi",
      title: `${city} consumer price index`,
      explanation: `Latest observation in unified merge: period ${strip.cpi.latest_period || "n/a"}.`,
      chart: {
        type: "card",
        headline: String(strip.cpi.value),
        detail: strip.cpi.latest_period ? `Period: ${strip.cpi.latest_period}` : undefined,
      },
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (
    /\b(grocery|listing|listings|kaggle)\b.*\b(price|prices)\b|\b(price|prices)\b.*\b(grocery|listing|month)\b|\bmean list price\b/.test(q)
  ) {
    if (!strip.grocery?.series.length) {
      return {
        intent: "grocery_prices",
        title: "Grocery list prices",
        explanation: "No grocery_listings_by_month rows in unified_signal.json.",
        chart: null,
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
    const s = strip.grocery.series;
    return {
      intent: "grocery_prices",
      title: "Sampled grocery mean list price",
      explanation:
        "Mean list price from merged monthly listing samples (not a store census). Useful as a directional price-pressure dial with CPI.",
      chart: {
        type: "bar",
        labels: s.map((r) => ymLabel(r.month)),
        values: s.map((r) => r.mean),
        valuePrefix: "$",
        decimals: 2,
      },
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  return {
    intent: "help",
    title: "No matching intent yet",
    explanation:
      "This beta NLQ router only recognizes a few phrases. Try one of the suggestions, or add keywords like “CPI”, “Ontario retail”, “grocery price”, or “soup companions”.",
    chart: null,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
