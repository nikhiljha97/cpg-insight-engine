/**
 * Public Reddit JSON listings (hot) — no OAuth. Reddit may rate-limit; use descriptive User-Agent per their policy.
 * Lexicon sentiment is a rough prototype — not NLP-grade.
 *
 * "Free Reddit API": read-only JSON from www.reddit.com is unauthenticated but intended for light use.
 * For higher volume or private subs, register a free "script" app at reddit.com/prefs/apps and use OAuth.
 */
const USER_AGENT =
  "web:cpg-insight-engine:v1.4 (+https://github.com/nikhiljha97/cpg-insight-engine)";

/** Canada-relevant communities (English). */
export const REDDIT_GROCERY_SUBS = [
  "canada",
  "AskCanada",
  "PersonalFinanceCanada",
  "Toronto",
  "vancouver",
  "Calgary",
  "onguardforthee",
  "BuyCanadian",
  "canadianfinance",
] as const;

/** Match if any pattern hits — broader than v1 so the page is not empty when "hot" is politics-heavy. */
const GROCERY_TITLE_PATTERNS: RegExp[] = [
  /\b(grocery|groceries|supermarket|food\s*bank|food\s*price|food\s*inflation|loblaw|sobeys|costco|walmart|shrinkflation|no\s*frills|freshco|metro\b|safeway|superstore)\b/i,
  /\b(inflation|cpi|afford|checkout|shopping\s+cart|price\s+of\s+food|eating\s+out|restaurant\s+prices|takeout|delivery\s+fees)\b/i,
  /\b(produce|dairy|pantry|meal\s*prep|student\s+food|rent\s+and\s+food|household\s+budget|grocery\s+bill)\b/i,
  /\b(food|hungry|hunger)\b.*\b(price|cost|expensive|cheap|afford)\b|\b(price|cost|expensive)\b.*\b(food|grocer)\b/i,
];

const POS =
  /\b(great|love|deal|cheap|better|happy|relief|good\s+news|finally|stocked|fresh|support|win)\b/i;
const NEG =
  /\b(expensive|price\s*gouging|angry|ridiculous|unaffordable|worst|shrinkflation|empty\s+shelves|shortage|struggle|scam|brutal|insane)\b/i;

export type RedditGroceryPost = {
  subreddit: string;
  title: string;
  link: string;
  published?: string;
  sentiment: number;
  /** True when title matched grocery/shopping heuristics (score is meaningful). */
  groceryMatch: boolean;
};

type RedditListingChild = {
  kind: string;
  data?: {
    title?: string;
    permalink?: string;
    url?: string;
    subreddit?: string;
    created_utc?: number;
    stickied?: boolean;
    is_self?: boolean;
  };
};

function isGroceryTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 6) return false;
  return GROCERY_TITLE_PATTERNS.some((re) => re.test(t));
}

function scoreTitle(title: string, grocery: boolean): number {
  if (!grocery) return 0;
  let s = 0;
  if (POS.test(title)) s += 0.35;
  if (NEG.test(title)) s -= 0.45;
  if (/[!?]{2,}/.test(title)) s -= 0.08;
  return Math.max(-1, Math.min(1, s));
}

function parseHotJson(json: unknown, subreddit: string): RedditGroceryPost[] {
  const out: RedditGroceryPost[] = [];
  const root = json as { data?: { children?: RedditListingChild[] } };
  const children = root.data?.children ?? [];
  for (const ch of children) {
    if (ch.kind !== "t3" || !ch.data) continue;
    const d = ch.data;
    if (d.stickied) continue;
    const title = (d.title ?? "").trim();
    if (!title || /^reddit:/i.test(title)) continue;
    const permalink = d.permalink ?? "";
    const link = permalink.startsWith("http")
      ? permalink
      : `https://www.reddit.com${permalink.startsWith("/") ? permalink : "/" + permalink}`;
    const published =
      typeof d.created_utc === "number" ? new Date(d.created_utc * 1000).toISOString() : undefined;
    const grocery = isGroceryTitle(title);
    out.push({
      subreddit: d.subreddit ?? subreddit,
      title,
      link,
      published,
      sentiment: scoreTitle(title, grocery),
      groceryMatch: grocery,
    });
  }
  return out;
}

async function fetchSubHotJson(sub: string): Promise<{ sub: string; posts: RedditGroceryPost[]; err?: string }> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?raw_json=1&limit=22`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { sub, posts: [], err: `${sub}: HTTP ${res.status}` };
    }
    const json: unknown = await res.json();
    return { sub, posts: parseHotJson(json, sub) };
  } catch (e) {
    return { sub, posts: [], err: `${sub}: ${e instanceof Error ? e.message : "fetch failed"}` };
  }
}

export async function fetchRedditGrocerySentimentSnapshot(): Promise<{
  fetchedAt: string;
  aggregateScore: number;
  matchedCount: number;
  posts: RedditGroceryPost[];
  usedFallback: boolean;
  subreddits: string[];
  methodology: string;
}> {
  const all: RedditGroceryPost[] = [];
  const errors: string[] = [];

  const results = await Promise.all(REDDIT_GROCERY_SUBS.map((s) => fetchSubHotJson(s)));
  for (const r of results) {
    if (r.err) errors.push(r.err);
    all.push(...r.posts);
  }

  const groceryPosts = all.filter((p) => p.groceryMatch);
  const usedFallback = groceryPosts.length === 0 && all.length > 0;

  /** De-dupe by link, prefer grocery match */
  const byLink = new Map<string, RedditGroceryPost>();
  for (const p of all) {
    const prev = byLink.get(p.link);
    if (!prev || (p.groceryMatch && !prev.groceryMatch)) byLink.set(p.link, p);
  }
  const unique = [...byLink.values()];

  const groceryUnique = unique.filter((p) => p.groceryMatch);
  const displayPosts = groceryUnique.length
    ? groceryUnique.sort((a, b) => b.sentiment - a.sentiment).slice(0, 40)
    : unique
        .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
        .slice(0, 28);

  const aggSource = groceryUnique.length ? groceryUnique : [];
  const agg =
    aggSource.length === 0 ? 0 : aggSource.reduce((s, p) => s + p.sentiment, 0) / aggSource.length;

  const methodology = [
    `Sources: public https://www.reddit.com/r/{sub}/hot.json (no OAuth) for ${REDDIT_GROCERY_SUBS.join(", ")}.`,
    "Titles are heuristically tagged for grocery / food-price / shopping context, then scored with a small positive/negative lexicon.",
    usedFallback
      ? "No grocery-tagged titles in this pull — showing unfiltered hot threads so the panel is not empty (scores are neutral)."
      : "",
    "Reddit is not representative of Canadian shoppers; English bias; corporate/marketing posts may skew hot.",
    "Free tier: unauthenticated JSON is fine for low-volume dashboards; for production use a registered Reddit app (script OAuth) + caching and respect rate limits (see https://github.com/reddit-archive/reddit/wiki/API).",
    errors.length ? `Fetch notes: ${errors.slice(0, 5).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    fetchedAt: new Date().toISOString(),
    aggregateScore: Math.round(agg * 1000) / 1000,
    matchedCount: groceryUnique.length,
    posts: displayPosts,
    usedFallback,
    subreddits: [...REDDIT_GROCERY_SUBS],
    methodology,
  };
}
