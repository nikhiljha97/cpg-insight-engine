/**
 * Public subreddit RSS snapshots, filtered to grocery / shopping / food-price themes.
 * Lexicon sentiment is a rough prototype — not NLP-grade; Reddit is a biased sample.
 */
const USER_AGENT =
  "Mozilla/5.0 (compatible; CPG-Insight-Engine/1.1; +https://github.com/nikhiljha97/cpg-insight-engine)";

/** Canada-relevant communities (English). Posts are filtered client-side by grocery keywords. */
export const REDDIT_GROCERY_SUBS = [
  "canada",
  "AskCanada",
  "PersonalFinanceCanada",
  "Toronto",
  "vancouver",
  "Calgary",
  "onguardforthee",
] as const;

const GROCERY_RE =
  /\b(grocery|groceries|supermarket|food\s*price|food\s*inflation|loblaws|sobeys|metro\s+inc|no\s*frills|costco|walmart|cart|checkout|shrinkflation|produce|dairy|pantry|takeout|restaurant\s+prices|shopping\s+for\s+food|food\s+bank)\b/i;

const POS =
  /\b(great|love|deal|cheap|better|happy|relief|good\s+news|finally|stocked|fresh|support)\b/i;
const NEG =
  /\b(expensive|price\s*gouging|angry|ridiculous|unaffordable|worst|shrinkflation|empty\s+shelves|shortage|struggle|scam)\b/i;

export type RedditGroceryPost = {
  subreddit: string;
  title: string;
  link: string;
  published?: string;
  sentiment: number;
  matched: boolean;
};

function parseRssItems(xml: string, subreddit: string): { title: string; link: string; pubDate?: string }[] {
  const items: { title: string; link: string; pubDate?: string }[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const t = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
    const l = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(block);
    const p = /<pubDate>([^<]*)<\/pubDate>/i.exec(block);
    const title = (t?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const link = (l?.[1] ?? "").trim();
    if (title && link) items.push({ title, link, pubDate: p?.[1]?.trim() });
  }
  return items;
}

function scoreTitle(title: string): { sentiment: number; matched: boolean } {
  if (!GROCERY_RE.test(title)) return { sentiment: 0, matched: false };
  let s = 0;
  if (POS.test(title)) s += 0.35;
  if (NEG.test(title)) s -= 0.45;
  if (/[!?]{2,}/.test(title)) s -= 0.08;
  return { sentiment: Math.max(-1, Math.min(1, s)), matched: true };
}

export async function fetchRedditGrocerySentimentSnapshot(): Promise<{
  fetchedAt: string;
  aggregateScore: number;
  matchedCount: number;
  posts: RedditGroceryPost[];
  subreddits: string[];
  methodology: string;
}> {
  const posts: RedditGroceryPost[] = [];
  const errors: string[] = [];

  for (const sub of REDDIT_GROCERY_SUBS) {
    const url = `https://www.reddit.com/r/${sub}/hot.rss?limit=15`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        errors.push(`${sub}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const raw = parseRssItems(xml, sub);
      for (const row of raw) {
        if (/^reddit:/i.test(row.title)) continue;
        const { sentiment, matched } = scoreTitle(row.title);
        posts.push({
          subreddit: sub,
          title: row.title,
          link: row.link,
          published: row.pubDate,
          sentiment,
          matched,
        });
      }
    } catch (e) {
      errors.push(`${sub}: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  const matched = posts.filter((p) => p.matched);
  const agg =
    matched.length === 0 ? 0 : matched.reduce((s, p) => s + p.sentiment, 0) / matched.length;

  return {
    fetchedAt: new Date().toISOString(),
    aggregateScore: Math.round(agg * 1000) / 1000,
    matchedCount: matched.length,
    posts: posts.filter((p) => p.matched).slice(0, 40),
    subreddits: [...REDDIT_GROCERY_SUBS],
    methodology:
      `Reddit public RSS (hot) from ${REDDIT_GROCERY_SUBS.join(", ")} — titles only, keyword filter for grocery/shopping/food-price language, simple positive/negative lexicon. English bias; not representative of Canadian shoppers overall. ${errors.length ? "Partial errors: " + errors.slice(0, 3).join("; ") : ""}`.trim(),
  };
}
