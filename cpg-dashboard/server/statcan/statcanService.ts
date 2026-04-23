/**
 * Statistics Canada Web Data Service (WDS) integration.
 * Catalog aligns with Agriculture & food subject (32 / 3205) like the official browse URL:
 * https://www150.statcan.gc.ca/n1/en/type/data?subject_levels=32%2C3205&sort=releasedate&count=100
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
const CATALOG_BROWSE_URL =
  "https://www150.statcan.gc.ca/n1/en/type/data?subject_levels=32%2C3205&sort=releasedate&count=100";

type LiteCube = {
  productId: number;
  cansimId: string | null;
  cubeTitleEn: string;
  cubeEndDate?: string;
  releaseTime?: string;
  archived?: string;
  subjectCode?: string[];
  frequencyCode?: number;
};

export type CuratedSeriesConfig = {
  id: string;
  productId: number;
  coordinate: string;
  titleEn: string;
  tablePid: number;
};

type DataPoint = {
  refPer: string;
  value: number;
};

type SeriesSnapshot = {
  id: string;
  titleEn: string;
  productId: number;
  coordinate: string;
  frequencyCode: number;
  frequencyDesc: string;
  releaseTime?: string;
  tableUrl: string;
  vectorId?: number;
  latestPoints: DataPoint[];
  lastFetchedAt: string;
};

type CatalogEntry = {
  productId: number;
  cansimId: string | null;
  titleEn: string;
  frequencyCode: number;
  frequencyDesc: string;
  releaseTime?: string;
  cubeEndDate?: string;
  tableUrl: string;
};

export type CatalogAutoPreview = CatalogEntry & {
  coordinate: string;
  previewPoints: DataPoint[];
  discoveryNote?: string;
};

export type StatCanSummary = {
  attribution: string;
  catalogBrowseUrl: string;
  wdsNote: string;
  generatedAt: string;
  liteListSyncedAt: string | null;
  catalogEntryCount: number;
  catalogSample: CatalogEntry[];
  /** Auto-picked coordinates via WDS metadata (bounded + cached). */
  catalogAutoPreviews: CatalogAutoPreview[];
  curated: SeriesSnapshot[];
};

const STATCAN_UA =
  process.env.STATCAN_USER_AGENT?.trim() ||
  process.env.REDDIT_USER_AGENT?.trim() ||
  "CPG-Insight-Engine/1.0 (StatCan WDS; retail analytics)";

function dataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "..", "data", "statcan");
}

function litePath(): string {
  return path.join(dataDir(), "lite-list.json");
}
function catalogPath(): string {
  return path.join(dataDir(), "catalog.json");
}
function statePath(): string {
  return path.join(dataDir(), "state.json");
}
function codeSetsPath(): string {
  return path.join(dataDir(), "code-sets.json");
}
function autoPreviewCachePath(): string {
  return path.join(dataDir(), "auto-preview-cache.json");
}

function curatedPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "curated-series.json");
}

function tableUrl(pid: number): string {
  return `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${pid}`;
}

function ensureDir(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
}

const TITLE_INCLUDE =
  /(egg|eggs|grocery|grocer|retail\s+price|consumer\s+price|\bcpi\b|\bfood\b|farm\s+product\s+price|farm\s+cash|processed\s+eggs|frozen\s+eggs|supermarket|agricultural\s+product|principal\s+field\s+crops|vegetables|fruits|potatoes|dairy|poultry)/i;
const TITLE_EXCLUDE =
  /(united\s+states|\bmexico\b|\bndvi\b|vegetation\s+indices|correctional|probation|young\s+persons|normalized\s+difference)/i;

function subjectStarts32(subjectCode?: string[]): boolean {
  return (subjectCode ?? []).some((s) => String(s).startsWith("32"));
}

function titleRelevantForFoodGroceryEggs(title: string): boolean {
  if (!TITLE_INCLUDE.test(title)) return false;
  if (TITLE_EXCLUDE.test(title)) return false;
  return true;
}

type CodeSets = { frequency: { frequencyCode: number; frequencyDescEn: string }[] };

async function loadFrequencyMap(): Promise<Map<number, string>> {
  ensureDir();
  const map = new Map<number, string>();
  try {
    if (fs.existsSync(codeSetsPath())) {
      const cached = JSON.parse(fs.readFileSync(codeSetsPath(), "utf8")) as CodeSets;
      for (const f of cached.frequency ?? []) {
        map.set(f.frequencyCode, f.frequencyDescEn);
      }
      if (map.size) return map;
    }
  } catch {
    /* fall through */
  }
  const res = await fetch(`${WDS_BASE}/getCodeSets`, { headers: { "User-Agent": STATCAN_UA } });
  if (!res.ok) throw new Error(`getCodeSets HTTP ${res.status}`);
  const json = (await res.json()) as { object?: CodeSets };
  const obj = json.object ?? { frequency: [] };
  fs.writeFileSync(codeSetsPath(), JSON.stringify(obj), "utf8");
  for (const f of obj.frequency ?? []) {
    map.set(f.frequencyCode, f.frequencyDescEn);
  }
  return map;
}

function shouldRefreshSeries(lastIso: string | undefined, frequencyCode: number): boolean {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  const now = Date.now();
  const days = (now - last) / 86400000;
  const lastMonth = new Date(last).getUTCMonth();
  const lastYear = new Date(last).getUTCFullYear();
  const curMonth = new Date().getUTCMonth();
  const curYear = new Date().getUTCFullYear();
  switch (frequencyCode) {
    case 1:
      return days >= 1.5;
    case 2:
      return days >= 6;
    case 4:
      return days >= 12;
    case 6:
      return days >= 26 || curMonth !== lastMonth || curYear !== lastYear;
    case 7:
      return days >= 55;
    case 9:
      return days >= 85;
    case 11:
      return days >= 160;
    case 12:
      return days >= 300 || curYear !== lastYear;
    default:
      return days >= 30;
  }
}

function shouldRefreshLiteList(lastIso: string | undefined, maxDays = 1): boolean {
  if (!lastIso) return true;
  const days = (Date.now() - new Date(lastIso).getTime()) / 86400000;
  return days >= maxDays;
}

type StateFile = {
  liteListFetchedAt?: string;
  series?: Record<string, { lastFetchedAt?: string }>;
};

function readState(): StateFile {
  try {
    if (fs.existsSync(statePath())) {
      return JSON.parse(fs.readFileSync(statePath(), "utf8")) as StateFile;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeState(s: StateFile): void {
  ensureDir();
  fs.writeFileSync(statePath(), JSON.stringify(s, null, 2), "utf8");
}

async function fetchLiteList(): Promise<LiteCube[]> {
  const res = await fetch(`${WDS_BASE}/getAllCubesListLite`, { headers: { "User-Agent": STATCAN_UA } });
  if (!res.ok) throw new Error(`getAllCubesListLite HTTP ${res.status}`);
  return (await res.json()) as LiteCube[];
}

async function syncLiteListIfNeeded(force: boolean): Promise<LiteCube[]> {
  ensureDir();
  const state = readState();
  const diskFresh =
    fs.existsSync(litePath()) &&
    !force &&
    !shouldRefreshLiteList(state.liteListFetchedAt, 1) &&
    fs.statSync(litePath()).size > 1_000_000;
  if (diskFresh) {
    return JSON.parse(fs.readFileSync(litePath(), "utf8")) as LiteCube[];
  }
  const list = await fetchLiteList();
  fs.writeFileSync(litePath(), JSON.stringify(list), "utf8");
  state.liteListFetchedAt = new Date().toISOString();
  writeState(state);
  return list;
}

function buildCatalog(list: LiteCube[], freq: Map<number, string>): CatalogEntry[] {
  const rows: CatalogEntry[] = [];
  for (const c of list) {
    if (c.archived === "1") continue;
    if (!subjectStarts32(c.subjectCode)) continue;
    if (!titleRelevantForFoodGroceryEggs(c.cubeTitleEn)) continue;
    rows.push({
      productId: c.productId,
      cansimId: c.cansimId,
      titleEn: c.cubeTitleEn,
      frequencyCode: c.frequencyCode ?? 0,
      frequencyDesc: freq.get(c.frequencyCode ?? 0) ?? "Unknown",
      releaseTime: c.releaseTime,
      cubeEndDate: c.cubeEndDate,
      tableUrl: tableUrl(c.productId)
    });
  }
  rows.sort((a, b) => String(b.releaseTime ?? "").localeCompare(String(a.releaseTime ?? "")));
  return rows;
}

async function fetchSeriesPoints(
  productId: number,
  coordinate: string,
  latestN: number
): Promise<{ vectorId?: number; points: DataPoint[] }> {
  const res = await fetch(`${WDS_BASE}/getDataFromCubePidCoordAndLatestNPeriods`, {
    method: "POST",
    headers: {
      "User-Agent": STATCAN_UA,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify([{ productId, coordinate, latestN }])
  });
  if (!res.ok) throw new Error(`getData HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    object?: {
      vectorId?: number;
      vectorDataPoint?: { refPer: string; value: number }[];
    };
  }[];
  const first = json[0];
  if (!first || first.status !== "SUCCESS" || !first.object?.vectorDataPoint) {
    return { points: [] };
  }
  const pts = first.object.vectorDataPoint.map((p) => ({ refPer: p.refPer, value: p.value }));
  return { vectorId: first.object.vectorId, points: pts };
}

function readCurated(): CuratedSeriesConfig[] {
  const raw = fs.readFileSync(curatedPath(), "utf8");
  return JSON.parse(raw) as CuratedSeriesConfig[];
}

function lookupFrequency(list: LiteCube[], productId: number): number {
  const hit = list.find((c) => c.productId === productId);
  return hit?.frequencyCode ?? 6;
}

function readCachedSnapshot(id: string): SeriesSnapshot | null {
  try {
    const p = path.join(dataDir(), `series-${id}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as SeriesSnapshot;
  } catch {
    return null;
  }
}

function writeSeriesSnapshot(snap: SeriesSnapshot): void {
  const p = path.join(dataDir(), `series-${snap.id}.json`);
  fs.writeFileSync(p, JSON.stringify(snap, null, 2), "utf8");
}

type WdsDimension = {
  dimensionPositionId: number;
  dimensionNameEn?: string;
  member?: { memberId: number; memberNameEn?: string }[];
};

type CubeMetaObject = {
  dimension: WdsDimension[];
};

type AutoPreviewCacheEntry = {
  coordinate: string;
  previewPoints: DataPoint[];
  updatedAt: string;
  discoveryNote?: string;
};

type AutoPreviewCache = Record<string, AutoPreviewCacheEntry>;

function readAutoPreviewCache(): AutoPreviewCache {
  try {
    if (fs.existsSync(autoPreviewCachePath())) {
      return JSON.parse(fs.readFileSync(autoPreviewCachePath(), "utf8")) as AutoPreviewCache;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeAutoPreviewCache(cache: AutoPreviewCache): void {
  ensureDir();
  fs.writeFileSync(autoPreviewCachePath(), JSON.stringify(cache, null, 2), "utf8");
}

function staleHours(iso: string | undefined, hours: number): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > hours * 3600_000;
}

function pickMemberId(dim: WdsDimension): number {
  const members = dim.member ?? [];
  if (!members.length) return 0;
  const dn = (dim.dimensionNameEn ?? "").toLowerCase();
  if (dn.includes("geo")) {
    const canada = members.find((m) => /^canada$/i.test((m.memberNameEn ?? "").trim()));
    if (canada) return canada.memberId;
    const ca2 = members.find((m) => (m.memberNameEn ?? "").toLowerCase().includes("canada"));
    if (ca2) return ca2.memberId;
    return members[0].memberId;
  }
  const total = members.find((m) =>
    /\btotal\b|^all commodities|all divisions|entire country|national\b/i.test(m.memberNameEn ?? "")
  );
  if (total) return total.memberId;
  const one = members.find((m) => m.memberId === 1);
  if (one) return 1;
  return members[0].memberId;
}

function buildCoordinate(meta: CubeMetaObject, strategy: "smart" | "firstMembers"): string {
  const dims = [...meta.dimension].sort((a, b) => a.dimensionPositionId - b.dimensionPositionId);
  const parts = new Array(10).fill(0);
  for (const d of dims) {
    const i = d.dimensionPositionId - 1;
    if (i < 0 || i > 9) continue;
    if (strategy === "firstMembers" && d.member?.[0]) {
      parts[i] = d.member[0].memberId;
    } else {
      parts[i] = pickMemberId(d);
    }
  }
  return parts.join(".");
}

async function fetchCubeMetadata(productId: number): Promise<CubeMetaObject | null> {
  const res = await fetch(`${WDS_BASE}/getCubeMetadata`, {
    method: "POST",
    headers: {
      "User-Agent": STATCAN_UA,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify([{ productId }])
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: string; object?: CubeMetaObject }[];
  const row = json[0];
  if (!row || row.status !== "SUCCESS" || !row.object?.dimension?.length) {
    return null;
  }
  return row.object;
}

async function buildAutoPreview(
  entry: CatalogEntry,
  options: { force: boolean; cache: AutoPreviewCache }
): Promise<CatalogAutoPreview | null> {
  const key = String(entry.productId);
  const cached = options.cache[key];
  const cacheHours = Number.parseInt(process.env.STATCAN_AUTO_PREVIEW_CACHE_HOURS ?? "12", 10);
  if (!options.force && cached && !staleHours(cached.updatedAt, cacheHours)) {
    return {
      ...entry,
      coordinate: cached.coordinate,
      previewPoints: cached.previewPoints,
      discoveryNote: cached.discoveryNote ? `${cached.discoveryNote} (cached)` : "cached"
    };
  }

  const meta = await fetchCubeMetadata(entry.productId);
  if (!meta) {
    return null;
  }

  const tryCoords = [buildCoordinate(meta, "smart"), buildCoordinate(meta, "firstMembers")];
  const uniq = [...new Set(tryCoords)];
  let points: DataPoint[] = [];
  let used = "";
  let note = "";
  for (const coord of uniq) {
    const res = await fetchSeriesPoints(entry.productId, coord, 4);
    if (res.points.length) {
      points = res.points;
      used = coord;
      note = coord === tryCoords[0] ? "smart-dimension pick" : "fallback first member per dimension";
      break;
    }
  }
  if (!points.length) {
    return null;
  }

  options.cache[key] = {
    coordinate: used,
    previewPoints: points,
    updatedAt: new Date().toISOString(),
    discoveryNote: note
  };

  return {
    ...entry,
    coordinate: used,
    previewPoints: points,
    discoveryNote: note
  };
}

async function buildAutoPreviewsForCatalog(
  catalog: CatalogEntry[],
  curatedProductIds: Set<number>,
  options: { force: boolean }
): Promise<CatalogAutoPreview[]> {
  const max = Math.min(25, Math.max(0, Number.parseInt(process.env.STATCAN_AUTO_DISCOVER_MAX ?? "8", 10)));
  if (max === 0) return [];

  const cache = readAutoPreviewCache();
  const out: CatalogAutoPreview[] = [];
  for (const row of catalog) {
    if (curatedProductIds.has(row.productId)) continue;
    if (out.length >= max) break;
    const prev = await buildAutoPreview(row, { force: options.force, cache });
    if (prev) {
      out.push(prev);
      await new Promise((r) => setTimeout(r, 220));
    }
  }
  writeAutoPreviewCache(cache);
  return out;
}

export async function getStatCanSummary(options?: {
  forceCatalog?: boolean;
  forceSeries?: boolean;
  forceAutoDiscover?: boolean;
}): Promise<StatCanSummary> {
  ensureDir();
  const freq = await loadFrequencyMap();
  const list = await syncLiteListIfNeeded(Boolean(options?.forceCatalog));
  const catalog = buildCatalog(list, freq);
  fs.writeFileSync(catalogPath(), JSON.stringify({ builtAt: new Date().toISOString(), entries: catalog }, null, 2), "utf8");

  let state = readState();
  state.series = state.series ?? {};
  const curated = readCurated();
  const snapshots: SeriesSnapshot[] = [];

  for (const row of curated) {
    const frequencyCode = lookupFrequency(list, row.productId);
    const last = state.series[row.id]?.lastFetchedAt;
    const needFetch = Boolean(options?.forceSeries) || shouldRefreshSeries(last, frequencyCode);
    let snap: SeriesSnapshot | null = null;
    if (!needFetch) {
      snap = readCachedSnapshot(row.id);
    }
    if (!snap) {
      const { points, vectorId } = await fetchSeriesPoints(row.productId, row.coordinate, 6);
      snap = {
        id: row.id,
        titleEn: row.titleEn,
        productId: row.productId,
        coordinate: row.coordinate,
        frequencyCode,
        frequencyDesc: freq.get(frequencyCode) ?? "Unknown",
        releaseTime: list.find((c) => c.productId === row.productId)?.releaseTime,
        tableUrl: tableUrl(row.tablePid),
        vectorId,
        latestPoints: points,
        lastFetchedAt: new Date().toISOString()
      };
      writeSeriesSnapshot(snap);
      state.series[row.id] = { lastFetchedAt: snap.lastFetchedAt };
      writeState(state);
      state = readState();
      state.series = state.series ?? {};
    }
    snapshots.push(snap);
  }

  const st = readState();

  const curatedProductIds = new Set(curated.map((c) => c.productId));
  const catalogAutoPreviews = await buildAutoPreviewsForCatalog(catalog, curatedProductIds, {
    force: Boolean(options?.forceAutoDiscover)
  });

  return {
    attribution:
      "Data: Statistics Canada, Web Data Service (WDS). Reproduced and distributed on an \"as is\" basis with the permission of Statistics Canada.",
    catalogBrowseUrl: CATALOG_BROWSE_URL,
    wdsNote:
      "Uses WDS getAllCubesListLite (same universe as the Agriculture & food browse listing), title-filters for food / grocery / eggs, curated coordinates in curated-series.json, and bounded auto coordinate discovery from getCubeMetadata + getDataFromCubePidCoordAndLatestNPeriods (cached on disk).",
    generatedAt: new Date().toISOString(),
    liteListSyncedAt: st.liteListFetchedAt ?? null,
    catalogEntryCount: catalog.length,
    catalogSample: catalog.slice(0, 40),
    catalogAutoPreviews,
    curated: snapshots
  };
}
