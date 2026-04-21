export type RetailMonthPoint = { refPer: string; value: number };

export type RetailQuarterPoint = {
  label: string;
  sortKey: number;
  value: number;
  complete: boolean;
};

function parseYearMonth(refPer: string): { y: number; m: number } | null {
  const m = refPer.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

/** Calendar quarters; sums category $M within each quarter. Partial trailing quarter allowed. */
export function aggregateQuarterly(monthlyCategoryM: RetailMonthPoint[]): RetailQuarterPoint[] {
  const sorted = [...monthlyCategoryM].sort((a, b) => a.refPer.localeCompare(b.refPer));
  const buckets = new Map<number, { y: number; q: number; sum: number; months: number }>();

  for (const p of sorted) {
    const ym = parseYearMonth(p.refPer);
    if (!ym) continue;
    const q = Math.ceil(ym.m / 3);
    const sortKey = ym.y * 4 + q;
    const cur = buckets.get(sortKey) ?? { y: ym.y, q, sum: 0, months: 0 };
    cur.sum += p.value;
    cur.months += 1;
    buckets.set(sortKey, cur);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sortKey, { sum, months, y, q }]) => ({
      label: `${y} Q${q}${months < 3 ? " · partial" : ""}`,
      sortKey,
      value: Math.round(sum * 10) / 10,
      complete: months >= 3,
    }));
}

export function lastNQuarters(points: RetailQuarterPoint[], n: number): RetailQuarterPoint[] {
  if (points.length <= n) return points;
  return points.slice(-n);
}
