/**
 * Statistics Canada Web Data Service (WDS) — monthly values for a vector.
 * Values use scalarFactorCode 3 = thousands CAD → converted to millions ($M).
 */

export type RetailDataPoint = { period: string; value: number; unit: string };

type WdsBulkRow = {
  refPerRaw?: string;
  value?: number;
  scalarFactorCode?: number;
};

function periodFromRefPerRaw(raw: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(raw);
  if (m) return `${m[1]}-${m[2]}`;
  return raw.slice(0, 7);
}

function valueThousandsToMillions(value: number, scalarFactorCode: number): number {
  if (scalarFactorCode === 3) return Math.round((value / 1000) * 10) / 10;
  return Math.round(value * 10) / 10;
}

/** POST getBulkVectorDataByRange — returns monthly points oldest → newest. */
export async function fetchStatcanVectorMonthlyMillions(vectorId: number): Promise<RetailDataPoint[]> {
  const body = {
    vectorIds: [String(vectorId)],
    startDataPointReleaseDate: "2000-01-01T08:30:00",
    endDataPointReleaseDate: "2035-12-31T23:59:59",
  };
  const res = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getBulkVectorDataByRange", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; CPG-Dashboard/3.0; +https://github.com/)",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`StatCan WDS HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length === 0) throw new Error("StatCan WDS: empty response");
  const first = json[0] as { status?: string; object?: { vectorDataPoint?: WdsBulkRow[] } };
  if (first.status !== "SUCCESS" || !first.object?.vectorDataPoint) {
    throw new Error("StatCan WDS: unexpected payload");
  }
  const pts = first.object.vectorDataPoint;
  const out: RetailDataPoint[] = [];
  for (const p of pts) {
    const raw = p.refPerRaw;
    if (!raw || typeof p.value !== "number") continue;
    const sf = typeof p.scalarFactorCode === "number" ? p.scalarFactorCode : 3;
    out.push({
      period: periodFromRefPerRaw(raw),
      value: valueThousandsToMillions(p.value, sf),
      unit: "$M",
    });
  }
  out.sort((a, b) => a.period.localeCompare(b.period));
  // De-dupe by period (keep last)
  const m = new Map<string, RetailDataPoint>();
  for (const row of out) m.set(row.period, row);
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}
