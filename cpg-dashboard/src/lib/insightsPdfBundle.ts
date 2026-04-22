import { apiUrl } from "../api";
import { DEMAND_CATEGORY_LIST, type DemandCategory } from "../constants/demandCategories";

export type InsightsPdfScope = "all" | DemandCategory;

export type GatheredInsights = {
  scope: InsightsPdfScope;
  city: string;
  threshold: number;
  hotThreshold: number;
  generatedAt: string;
  unified: unknown;
  macroStrip: unknown;
  promo: unknown;
  priceElasticity: unknown;
  demographics: unknown;
  pitchHistory: unknown;
  traffic: unknown;
  baskets: Record<string, unknown>;
  ontarioRetail: Record<string, unknown>;
};

async function jget(path: string): Promise<unknown> {
  const r = await fetch(apiUrl(path));
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

export async function gatherInsightsForPdf(opts: {
  scope: InsightsPdfScope;
  city: string;
  threshold: number;
  hotThreshold: number;
}): Promise<GatheredInsights> {
  const { scope, city, threshold, hotThreshold } = opts;
  const categories: DemandCategory[] = scope === "all" ? [...DEMAND_CATEGORY_LIST] : [scope];

  const baseQs = new URLSearchParams({
    city,
    threshold: String(threshold),
    hotThreshold: String(hotThreshold),
  });

  const demoPath =
    scope === "all"
      ? "/api/signals/demographics"
      : `/api/signals/demographics?${new URLSearchParams({ demandCategory: scope }).toString()}`;

  const [unified, macroStrip, promo, priceElasticity, demographics, pitchHistory, traffic] = await Promise.all([
    jget("/api/signals/unified"),
    jget("/api/signals/macro-strip"),
    jget("/api/signals/promo"),
    jget("/api/signals/price-elasticity"),
    jget(demoPath),
    jget("/api/pitch-history"),
    jget("/api/traffic/gta"),
  ]);

  const baskets: Record<string, unknown> = {};
  const ontarioRetail: Record<string, unknown> = {};

  await Promise.all(
    categories.map(async (cat) => {
      const bq = new URLSearchParams(baseQs);
      bq.set("category", cat);
      const rq = new URLSearchParams({ demandCategory: cat });
      const [b, rt] = await Promise.all([
        jget(`/api/basket-insights?${bq.toString()}`),
        jget(`/api/statcan/ontario-retail?${rq.toString()}`),
      ]);
      baskets[cat] = b;
      ontarioRetail[cat] = rt;
    })
  );

  return {
    scope,
    city,
    threshold,
    hotThreshold,
    generatedAt: new Date().toISOString(),
    unified,
    macroStrip,
    promo,
    priceElasticity,
    demographics,
    pitchHistory,
    traffic,
    baskets,
    ontarioRetail,
  };
}
