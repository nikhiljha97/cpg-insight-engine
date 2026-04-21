/**
 * Small summary of retail_analytics fields from unified_signal.json
 * for the Dashboard macro header strip.
 */

export type MacroGrocerySeriesPoint = {
  month: string;
  mean: number;
  median?: number;
};

export type MacroStripGrocery = {
  mergedAt?: string;
  latestMonth: string;
  meanListPrice: number;
  medianListPrice?: number;
  prevMonth?: string;
  prevMean?: number;
  momPctMean: number | null;
  series: MacroGrocerySeriesPoint[];
};

export type MacroStripCpi = {
  value: number;
  latest_period: string;
  city?: string;
};

export type MacroStripPayload = {
  grocery: MacroStripGrocery | null;
  cpi: MacroStripCpi | null;
};

type GroceryRow = {
  month?: string;
  mean_list_price?: number;
  median_list_price?: number;
};

export function buildMacroStrip(unified: Record<string, unknown> | null): MacroStripPayload {
  if (!unified) return { grocery: null, cpi: null };

  const ra = unified.retail_analytics as Record<string, unknown> | undefined;
  if (!ra) return { grocery: null, cpi: null };

  const rawRows = (ra.grocery_listings_by_month as GroceryRow[] | undefined) ?? [];
  const rows = rawRows.filter(
    (r) => typeof r.month === "string" && r.month.length >= 7 && typeof r.mean_list_price === "number"
  );
  const sorted = [...rows].sort((a, b) => String(a.month).localeCompare(String(b.month)));

  let grocery: MacroStripGrocery | null = null;
  if (sorted.length) {
    const last = sorted[sorted.length - 1]!;
    const prev = sorted.length > 1 ? sorted[sorted.length - 2]! : undefined;
    const lastMean = last.mean_list_price!;
    const prevMean = prev?.mean_list_price;
    let momPctMean: number | null = null;
    if (prevMean != null && prevMean !== 0) {
      momPctMean = Number((((lastMean - prevMean) / prevMean) * 100).toFixed(1));
    }
    const series: MacroGrocerySeriesPoint[] = sorted.slice(-6).map((r) => ({
      month: String(r.month),
      mean: Number(r.mean_list_price),
      median: typeof r.median_list_price === "number" ? r.median_list_price : undefined,
    }));
    grocery = {
      mergedAt: typeof ra.merged_at === "string" ? ra.merged_at : undefined,
      latestMonth: String(last.month),
      meanListPrice: lastMean,
      medianListPrice: typeof last.median_list_price === "number" ? last.median_list_price : undefined,
      prevMonth: prev?.month ? String(prev.month) : undefined,
      prevMean: prevMean,
      momPctMean,
      series,
    };
  }

  const macro = ra.macro_cma as Record<string, unknown> | undefined;
  const cpiRaw = macro?.cpi as Record<string, unknown> | undefined;
  let cpi: MacroStripCpi | null = null;
  if (cpiRaw && cpiRaw.value != null && Number.isFinite(Number(cpiRaw.value))) {
    cpi = {
      value: Number(cpiRaw.value),
      latest_period: String(cpiRaw.latest_period ?? ""),
      city: typeof cpiRaw.city === "string" ? cpiRaw.city : undefined,
    };
  }

  return { grocery, cpi };
}
