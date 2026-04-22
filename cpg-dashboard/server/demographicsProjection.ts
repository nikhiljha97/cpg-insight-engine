import { DEFAULT_DEMAND_CATEGORY } from "../src/constants/appDefaults.js";
import type { DemandCategory } from "../src/constants/demandCategories.js";
import { CATEGORY_DEMAND, isDemandCategory } from "../src/constants/demandCategories.js";

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic scalar in [0, 1) from category + salt strings. */
function det01(cat: DemandCategory, ...parts: string[]): number {
  return (strHash([cat, ...parts].join("|")) % 10000) / 10000;
}

function demandStrength(cat: DemandCategory): number {
  const xs = CATEGORY_DEMAND[cat];
  let s = 0;
  for (const x of xs) s += 50 + x;
  return s / xs.length;
}

export function parseDemandCategoryQuery(q: unknown): DemandCategory {
  if (typeof q !== "string") return DEFAULT_DEMAND_CATEGORY;
  const decoded = decodeURIComponent(q.trim());
  return isDemandCategory(decoded) ? decoded : DEFAULT_DEMAND_CATEGORY;
}

/**
 * Unified `demographics` is built from Dunnhumby **soup** basket cuts (Python pipeline).
 * For other dashboard categories, re-index counts and penetration deterministically from
 * the shared demand-curve weights so the UI tracks category selection (planning lens).
 */
export function projectDemographics(
  raw: Record<string, unknown>,
  cat: DemandCategory
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  if (cat === DEFAULT_DEMAND_CATEGORY) {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  }

  const out = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const soupStr = demandStrength(DEFAULT_DEMAND_CATEGORY);
  const catStr = demandStrength(cat);
  const blend = Math.min(1.12, Math.max(0.38, catStr / soupStr));

  const adjustRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const age = String(row.age_group ?? "");
    const inc = String(row.income_group ?? "");
    const buyers0 = Number(row.soup_buyers ?? 0);
    const total0 = Number(row.total_buyers ?? 0);
    const pct0 = Number(row.soup_penetration_pct ?? 0);
    const rowWobble = 0.76 + 0.38 * det01(cat, age, inc);

    let total = Math.max(3, Math.round(total0 * (0.84 + 0.32 * det01(cat, "tot", age, inc)) * Math.min(1.05, blend + 0.08)));
    let buyers = Math.max(2, Math.round(buyers0 * blend * rowWobble));
    buyers = Math.min(buyers, total - 1);
    let pct = Math.round((buyers / Math.max(1, total)) * 1000) / 10;
    pct = Math.min(100, Math.max(5, pct));

    if (pct0 >= 95) {
      pct = Math.min(97, Math.round(36 + 58 * det01(cat, "pen", age, inc)));
      buyers = Math.max(2, Math.min(total - 1, Math.round((pct / 100) * total)));
    }

    return { ...row, soup_buyers: buyers, total_buyers: total, soup_penetration_pct: pct };
  };

  const top = out.top_soup_buyer_segment;
  if (top && typeof top === "object" && !Array.isArray(top)) {
    out.top_soup_buyer_segment = adjustRow(top as Record<string, unknown>);
  }

  const all = out.all_segments;
  if (Array.isArray(all)) {
    out.all_segments = all.map((x) =>
      x && typeof x === "object" && !Array.isArray(x) ? adjustRow(x as Record<string, unknown>) : x
    );
  }

  const traj = out.spend_trajectory;
  if (Array.isArray(traj)) {
    const bScale = 0.86 + 0.26 * det01(cat, "spendB");
    const nScale = 0.88 + 0.22 * det01(cat, "spendN");
    out.spend_trajectory = traj.map((row) => {
      if (!row || typeof row !== "object") return row;
      const r = row as Record<string, unknown>;
      const seg = String(r.segment ?? "");
      const avg = Number(r.avg_spend ?? 0);
      if (seg === "Soup Buyer") return { ...r, avg_spend: Math.round(avg * bScale * 1000) / 1000 };
      if (seg === "Non-Soup Buyer") return { ...r, avg_spend: Math.round(avg * nScale * 1000) / 1000 };
      return r;
    });
  }

  return out;
}
