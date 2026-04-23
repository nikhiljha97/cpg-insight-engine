/**
 * Canada-focused retail / grocery "pulse" via Reddit public search.json.
 * No OAuth: subject to Reddit terms, rate limits, and occasional HTTP errors.
 */

export type RedditSearchTemplate = {
  id: string;
  label: string;
  /** Passed to Reddit's q= (space-separated terms; Reddit search syntax is limited). */
  q: string;
  /**
   * Shorter query when using `/r/.../search?restrict_sr=on` (geography is implied by the subreddit union).
   * Falls back to `q` if omitted.
   */
  qInSubreddits?: string;
  /** Hint for UI only. */
  intent: string;
};

/** Ready-made bundles: Canada anchor + retail/grocery price language. */
export const CANADA_RETAIL_SEARCH_TEMPLATES: RedditSearchTemplate[] = [
  {
    id: "ca_grocery_inflation",
    label: "Grocery + inflation (Canada)",
    q: "(grocery OR groceries OR supermarket OR \"grocery prices\" OR \"food prices\") (Canada OR Canadian OR Ontario OR BC OR Alberta OR Quebec)",
    qInSubreddits: "(grocery OR groceries OR supermarket OR \"grocery prices\" OR \"food prices\")",
    intent: "Broad grocery price / inflation discussion anchored to Canada (quoted phrases reduce random \"food\" hits)."
  },
  {
    id: "ca_shrinkflation",
    label: "Shrinkflation + checkout",
    q: "(shrinkflation OR smaller package OR unit price) (grocery OR supermarket OR Loblaws OR Metro OR Sobeys) Canada",
    qInSubreddits: "(shrinkflation OR smaller package OR unit price) (grocery OR supermarket OR Loblaws OR Metro OR Sobeys)",
    intent: "Pack-size and shelf-price complaints."
  },
  {
    id: "ca_major_chains",
    label: "Major chains + price",
    q: "(Loblaws OR \"No Frills\" OR \"Real Canadian Superstore\" OR Metro OR Sobeys OR \"Food Basics\") (price OR expensive OR receipt OR inflation) Canada",
    qInSubreddits:
      "(Loblaws OR \"No Frills\" OR \"Real Canadian Superstore\" OR Metro OR Sobeys OR \"Food Basics\") (price OR expensive OR receipt OR inflation)",
    intent: "Named Canadian grocery banners + price language."
  },
  {
    id: "ca_food_inflation_bill",
    label: "Food inflation + household bill",
    q: "(\"food inflation\" OR \"grocery bill\" OR \"grocery prices\" OR \"cost of food\") (Canada OR Canadian)",
    qInSubreddits: "(\"food inflation\" OR \"grocery bill\" OR \"grocery prices\" OR \"cost of food\")",
    intent: "Phrase-level matches so lone words like \"food\" or \"bill\" do not dominate."
  },
  {
    id: "ca_discount_trade_down",
    label: "Discount / trade-down",
    q: "(Dollarama OR \"Walmart Canada\" OR Costco) (grocery OR groceries OR supermarket OR \"food prices\" OR flyer OR checkout) (Canada OR Canadian)",
    qInSubreddits:
      "(Dollarama OR \"Walmart Canada\" OR Costco) (grocery OR groceries OR supermarket OR \"food prices\" OR flyer OR checkout)",
    intent: "Value retailers + explicit grocery/shopping context (avoids generic \"Walmart\" + \"prices\")."
  },
  {
    id: "ca_policy_competition",
    label: "Competition / policy (grocery)",
    q: "(Competition Bureau OR \"grocery competition\" OR \"code of conduct\") Canada grocery",
    qInSubreddits: "(Competition Bureau OR \"grocery competition\" OR \"code of conduct\") grocery",
    intent: "Policy and market-structure threads (noisier; small sample)."
  },
  {
    id: "fr_qc_grocery",
    label: "French: épicerie / prix (Canada)",
    q: "(épicerie OR supermarché OR \"inflation alimentaire\") (prix OR facture OR coût) (Québec OR Quebec OR Canada)",
    qInSubreddits: "(épicerie OR supermarché OR \"inflation alimentaire\") (prix OR facture OR coût)",
    intent: "Quebec / bilingual grocery price vocabulary."
  },
  {
    id: "ca_receipt_checkout",
    label: "Receipt / checkout shock",
    q: "(receipt OR checkout OR \"my bill\" OR overpriced) (grocery OR supermarket) Canada",
    qInSubreddits: "(receipt OR checkout OR \"my bill\" OR overpriced) (grocery OR supermarket)",
    intent: "Purchase-moment frustration language."
  },
  {
    id: "ca_produce_dairy",
    label: "Staples: produce / dairy / meat",
    q: "(milk OR butter OR eggs OR chicken OR produce OR bananas) (price OR expensive OR inflation) Canada grocery",
    qInSubreddits: "(milk OR butter OR eggs OR chicken OR produce OR bananas) (price OR expensive OR inflation) grocery",
    intent: "Category-led price talk."
  },
  {
    id: "ca_retail_general",
    label: "Retail prices + food (Canada)",
    q: "(\"shelf price\" OR \"grocery prices\" OR \"supermarket prices\") (Canada OR Canadian) (grocery OR supermarket OR groceries)",
    qInSubreddits: "(\"shelf price\" OR \"grocery prices\" OR \"supermarket prices\") (grocery OR supermarket OR groceries)",
    intent: "Avoids bare \"retail prices\" + \"Canada\" matching cars, stocks, and hobbies."
  }
];

function uniqueSubredditNames(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const n = x.trim().toLowerCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Canada + provinces + major cities / regions for `r/a+b+c/search?restrict_sr=on`. Lowercase; invalid names simply return empty hits. */
const DEFAULT_CANADA_GEO_SUBREDDITS: string[] = uniqueSubredditNames([
  "canada",
  "AskCanada",
  "AskACanadian",
  "casualcanada",
  "buycanadian",
  "CanadaPublicPolicy",
  "PersonalFinanceCanada",
  "canadapersonalfinance",
  "alberta",
  "britishcolumbia",
  "manitoba",
  "newbrunswick",
  "newfoundland",
  "novascotia",
  "ontario",
  "pei",
  "quebec",
  "saskatchewan",
  "yukon",
  "northwestterritories",
  "nunavut",
  "toronto",
  "mississauga",
  "brampton",
  "markham",
  "vaughan",
  "oakville",
  "burlington",
  "hamilton",
  "kitchener",
  "waterloo",
  "cambridgeont",
  "guelph",
  "londonontario",
  "windsorontario",
  "kingstonontario",
  "ottawa",
  "barrie",
  "sudbury",
  "thunderbay",
  "niagara",
  "stcatharines",
  "peterborough",
  "oshawa",
  "whitby",
  "ajax",
  "pickering",
  "sarnia",
  "bellevilleontario",
  "vancouver",
  "VictoriaBC",
  "victoria",
  "surreybc",
  "burnaby",
  "coquitlam",
  "RichmondBC",
  "langley",
  "newwestminster",
  "northvancouver",
  "westvancouver",
  "kelowna",
  "kamloops",
  "nanaimo",
  "princegeorge",
  "calgary",
  "edmonton",
  "reddeer",
  "lethbridge",
  "medicinehat",
  "grandeprairie",
  "fortmcmurray",
  "Winnipeg",
  "regina",
  "saskatoon",
  "montreal",
  "Quebec",
  "laval",
  "gatineau",
  "longueuil",
  "sherbrooke",
  "troisrivieres",
  "quebeccity",
  "halifax",
  "dartmouth",
  "moncton",
  "fredericton",
  "saintjohnnb",
  "StJohnsNL",
  "charlottetown",
  "whitehorse",
  "Yellowknife",
  "Iqaluit",
  "yeg",
  "yyc",
  "vancouverisland",
  "frugal",
  "EatCheapAndHealthy",
  "BargainBin"
]);

function loadCanadaGeoSubreddits(): string[] {
  const extra =
    typeof process !== "undefined" && process.env.REDDIT_CANADA_GEO_SUBS
      ? process.env.REDDIT_CANADA_GEO_SUBS.split(/[\s,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 1 && /^[a-z0-9_]+$/.test(s))
      : [];
  return uniqueSubredditNames([...DEFAULT_CANADA_GEO_SUBREDDITS, ...extra]);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type RedditListingChild = {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    subreddit?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    is_self?: boolean;
  };
};

type RedditSearchResponse = {
  data?: {
    children?: RedditListingChild[];
    after?: string | null;
  };
};

export type RetailPulsePost = {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  createdUtc: number | null;
  snippet: string;
  matchedTemplates: string[];
  /** Server-side grocery / CPG signal (higher = more on-topic). */
  relevanceScore: number;
};

type MergedPulsePost = Omit<RetailPulsePost, "relevanceScore">;

export type RetailPulseResponse = {
  generatedAt: string;
  source: "reddit_public_search";
  oauthRequired: false;
  search: {
    mode: "subreddit_restrict_sr";
    subredditCount: number;
    chunkCount: number;
    chunkSize: number;
    /** First union (debug); full list is `subredditCount` names in server config. */
    samplePath: string;
  };
  templates: { id: string; label: string; q: string; fetched: number; ok: boolean; error?: string }[];
  posts: RetailPulsePost[];
  topTerms: { term: string; count: number }[];
  filter: {
    rawCandidates: number;
    kept: number;
    droppedSpam: number;
    droppedBlocklistSub: number;
    droppedLowRelevance: number;
    minRelevanceRaw: number;
  };
  disclaimer: string;
};

const DEFAULT_UA =
  "CPG-Insight-Engine/1.0 (Canada retail pulse; server-side; contact: local dev)";

function userAgent(): string {
  const fromEnv = typeof process !== "undefined" && process.env.REDDIT_USER_AGENT?.trim();
  return fromEnv && fromEnv.length > 8 ? fromEnv : DEFAULT_UA;
}

const STOP = new Set(
  `the a an and or for to of in on at is are was were be been being it this that these those with from as by
  i me my we our you your he she they them their not no yes so if but than then just about into out up down
  https http com www reddit imgur ca ve ll re d m t s`.split(/\s+/)
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-zàâäéèêëïîôùûüç0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function buildSnippet(title: string, body: string, maxLen = 220): string {
  const raw = `${title} ${body}`.replace(/\s+/g, " ").trim();
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen - 1)}…`;
}

function restrictedSubredditSearchUrl(subreddits: string[], q: string, limit: number): string {
  const path = subreddits.map((s) => encodeURIComponent(s)).join("+");
  const params = new URLSearchParams({
    q,
    restrict_sr: "on",
    sort: "new",
    t: "month",
    limit: String(limit),
    raw_json: "1"
  });
  return `https://www.reddit.com/r/${path}/search.json?${params.toString()}`;
}

async function fetchRestrictedSubSearch(
  q: string,
  subreddits: string[],
  limit: number
): Promise<{ posts: RedditListingChild[]; error?: string }> {
  if (!subreddits.length) {
    return { posts: [], error: "no_subreddits" };
  }
  const url = restrictedSubredditSearchUrl(subreddits, q, limit);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      return { posts: [], error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as RedditSearchResponse;
    const children = json.data?.children ?? [];
    return { posts: children };
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return { posts: [], error: message };
  }
}

function postKey(child: RedditListingChild): string | null {
  const id = child.data?.id;
  if (!id) return null;
  return id;
}

/** Subs that almost never carry grocery signal for this product (referrals, trading, niche retail). */
const SUBREDDIT_BLOCKLIST = new Set(
  [
    "promocodes",
    "referralcodes",
    "referralcode",
    "canadareferralcodes",
    "canadareferralshare",
    "canadianreferral",
    "referralcodesnation",
    "referrallinksnation",
    "referralsfordummies",
    "gcstrading",
    "gctrading",
    "giftcardexchange",
    "signupsforpay",
    "slavelabour",
    "beermoney",
    "pennystocks",
    "pennystockscanada",
    "canadastocks",
    "weedstocks",
    "foreveralonedating",
    "dirtyr4r",
    "r4r",
    "hockeycards",
    "animefigures",
    "vintagestory",
    "vintagestoryservers",
    "alignmentchartfills",
    "themepages",
    "louboutins",
    "weddingdress",
    "indianfashionaddicts",
    "manybaggers",
    "punjabi",
    "weightlosstechniques",
    "makenewfriendshere",
    "rav4club",
    "nintendoph",
    "bds",
    "skoteoutdoors",
    "movingtotheuk",
    "tuesdayswithstories",
    "hasuggestionsclub",
    "pmsforsale",
    "indiana"
  ].map((s) => s.toLowerCase())
);

/** Canada / city subs where a slightly lower lexical score is still plausible grocery chatter. */
const SUBREDDIT_TRUST_BONUS = new Set(
  [
    "canada",
    "askcanada",
    "askacanadian",
    "casualcanada",
    "buycanadian",
    "canadapersonalfinance",
    "personalfinancecanada",
    "ottawa",
    "toronto",
    "vancouver",
    "calgary",
    "edmonton",
    "montreal",
    "halifax",
    "winnipeg",
    "victoriabc",
    "ontario",
    "quebec",
    "alberta",
    "britishcolumbia",
    "newfoundland",
    "saskatchewan",
    "manitoba",
    "pei",
    "yeg",
    "yyc",
    "povertyfinance",
    "frugal",
    "eatcheapandhealthy",
    "bargainbin"
  ].map((s) => s.toLowerCase())
);

const GROCERY_SIGNALS: { re: RegExp; weight: number }[] = [
  { re: /\bgrocer(y|ies)\b/i, weight: 5 },
  { re: /\bsupermarket\b/i, weight: 5 },
  { re: /\bépicerie\b/i, weight: 5 },
  { re: /\binflation alimentaire\b/i, weight: 6 },
  { re: /\bshrinkflation\b/i, weight: 6 },
  { re: /\bweekly grocery\b/i, weight: 6 },
  { re: /\bgrocery bill\b/i, weight: 6 },
  { re: /\bgrocery prices\b/i, weight: 6 },
  { re: /\bfood inflation\b/i, weight: 5 },
  { re: /\bfood prices\b/i, weight: 4 },
  { re: /\bcost of food\b/i, weight: 5 },
  { re: /\b(food basics|no frills|loblaws|sobeys|safeway|farm boy|longos|freshco|foodland)\b/i, weight: 5 },
  { re: /\b(real canadian superstore|adonis|t&t)\b/i, weight: 5 },
  { re: /\b(dollarama|walmart canada|costco)\b.*\b(grocery|groceries|supermarket|food prices|flyer)\b/i, weight: 5 },
  { re: /\b(grocery|groceries|supermarket)\b.*\b(inflation|expensive|receipt|checkout|flyer|price)\b/i, weight: 5 },
  { re: /\b(milk|butter|eggs|bananas|produce|cantaloupe|chicken)\b.*\b(price|prices|expensive|flyer)\b/i, weight: 4 },
  { re: /\b(flyer|price match)\b.*\b(loblaws|metro|sobeys|walmart|no frills|costco|grocery)\b/i, weight: 4 },
  { re: /\bcompetition bureau\b.*\b(grocery|food)\b/i, weight: 5 },
  { re: /\bgrocery competition\b/i, weight: 5 },
  { re: /\bcode of conduct\b.*\b(grocery|retailers|food)\b/i, weight: 4 },
  { re: /\b(recalled|recall)\b.*\b(costco|loblaws|grocery|food)\b/i, weight: 5 },
  {
    re: /\b(cantaloupe|watermelon|strawberries|blueberries)\b[\s\S]{0,160}\b(price|prices|expensive|\$\d)/i,
    weight: 5
  }
];

function isLikelySpam(title: string, body: string): boolean {
  const t = `${title}\n${body}`.toLowerCase();
  if (/simplii|tangerine referral|eq bank referral|wealthsimple cash referral/.test(t)) return true;
  if (/\bm4[fm]\b|\[m4f\]|\[f4m\]|\[m4a\]/i.test(title)) return true;
  if (/\bpenny stocks?\b.*\b(tsx|cve:|otc|\.v)\b/i.test(t)) return true;
  if (/referral link.*\$\d{2,3}.*sign/i.test(t)) return true;
  if (/\[h\][^\n]{0,80}\[w\][^\n]{0,120}(btc|paypal|gift.?card|amazon|apple)/i.test(t)) return true;
  return false;
}

function rawGroceryScore(title: string, snippet: string): number {
  const text = `${title}\n${snippet}`;
  let score = 0;
  for (const { re, weight } of GROCERY_SIGNALS) {
    if (re.test(text)) score += weight;
  }
  return Math.min(score, 25);
}

function passesRelevance(title: string, snippet: string, subreddit: string): { ok: boolean; score: number } {
  const sub = subreddit.toLowerCase();
  const raw = rawGroceryScore(title, snippet);
  const bonus = SUBREDDIT_TRUST_BONUS.has(sub) ? 2 : 0;
  const score = Math.min(raw + bonus, 25);
  const minRaw = SUBREDDIT_TRUST_BONUS.has(sub) ? 3 : 4;
  const ok = raw >= minRaw && score >= 4;
  return { ok, score };
}

function aggregateTopTerms(posts: RetailPulsePost[], topN = 24): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of tokenize(`${p.title} ${p.snippet}`)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}

const CACHE_TTL_MS = 12 * 60 * 1000;
let cache: { expires: number; body: RetailPulseResponse } | null = null;

export async function getCanadaRetailPulse(options?: {
  /** Max posts per template (Reddit allows up to 100; keep small). */
  perTemplateLimit?: number;
  /** Max templates to run in one request (stay polite). */
  maxTemplates?: number;
  /** Subreddits per `r/a+b+…/search` request (URL size vs. number of HTTP calls). */
  subredditChunkSize?: number;
  forceRefresh?: boolean;
}): Promise<RetailPulseResponse> {
  const perTemplateLimit = Math.min(25, Math.max(5, options?.perTemplateLimit ?? 15));
  const maxTemplates = Math.min(CANADA_RETAIL_SEARCH_TEMPLATES.length, Math.max(3, options?.maxTemplates ?? 10));
  const chunkSize = Math.min(30, Math.max(8, options?.subredditChunkSize ?? 20));
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && cache && cache.expires > Date.now()) {
    return cache.body;
  }

  const geoSubsAll = loadCanadaGeoSubreddits();
  const geoSubs = geoSubsAll.length ? geoSubsAll : ["canada"];
  const chunks = chunkArray(geoSubs, chunkSize);
  const samplePath = `r/${chunks[0]?.slice(0, 6).join("+") ?? "canada"}${(chunks[0]?.length ?? 0) > 6 ? "+…" : ""}`;

  const templatesRun = CANADA_RETAIL_SEARCH_TEMPLATES.slice(0, maxTemplates);
  const templateMeta: RetailPulseResponse["templates"] = [];
  const byId = new Map<string, MergedPulsePost>();

  for (const tpl of templatesRun) {
    const queryText = tpl.qInSubreddits ?? tpl.q;
    let fetched = 0;
    let lastError: string | undefined;

    for (const chunk of chunks) {
      const { posts, error } = await fetchRestrictedSubSearch(queryText, chunk, perTemplateLimit);
      if (error) lastError = lastError ?? error;

      for (const child of posts) {
        const id = postKey(child);
        const d = child.data;
        if (!id || !d?.title) continue;
        fetched += 1;
        const permalink = d.permalink?.startsWith("/") ? `https://www.reddit.com${d.permalink}` : (d.url ?? "");
        const snippet = buildSnippet(d.title, d.is_self ? (d.selftext ?? "") : "");
        const existing = byId.get(id);
        if (existing) {
          if (!existing.matchedTemplates.includes(tpl.id)) {
            existing.matchedTemplates.push(tpl.id);
          }
        } else {
          byId.set(id, {
            id,
            title: d.title,
            subreddit: d.subreddit ?? "?",
            permalink: permalink || `https://www.reddit.com/r/${d.subreddit ?? "all"}`,
            createdUtc: typeof d.created_utc === "number" ? d.created_utc : null,
            snippet,
            matchedTemplates: [tpl.id]
          });
        }
      }
      await new Promise((r) => setTimeout(r, 320));
    }

    templateMeta.push({
      id: tpl.id,
      label: tpl.label,
      q: `${queryText} · restrict_sr · ${chunks.length} subreddit unions (~${chunkSize} names each)`,
      fetched,
      ok: !(fetched === 0 && Boolean(lastError)),
      error: fetched === 0 ? lastError : undefined
    });
    await new Promise((r) => setTimeout(r, 480));
  }

  const rawCandidates = byId.size;
  let droppedSpam = 0;
  let droppedBlocklistSub = 0;
  let droppedLowRelevance = 0;
  const posts: RetailPulsePost[] = [];

  for (const p of byId.values()) {
    if (isLikelySpam(p.title, p.snippet)) {
      droppedSpam += 1;
      continue;
    }
    if (SUBREDDIT_BLOCKLIST.has(p.subreddit.toLowerCase())) {
      droppedBlocklistSub += 1;
      continue;
    }
    const { ok, score } = passesRelevance(p.title, p.snippet, p.subreddit);
    if (!ok) {
      droppedLowRelevance += 1;
      continue;
    }
    posts.push({ ...p, relevanceScore: score });
  }

  posts.sort((a, b) => (b.createdUtc ?? 0) - (a.createdUtc ?? 0));
  const topPosts = posts.slice(0, 80);

  const body: RetailPulseResponse = {
    generatedAt: new Date().toISOString(),
    source: "reddit_public_search",
    oauthRequired: false,
    search: {
      mode: "subreddit_restrict_sr",
      subredditCount: geoSubs.length,
      chunkCount: chunks.length,
      chunkSize,
      samplePath
    },
    templates: templateMeta,
    posts: topPosts,
    topTerms: aggregateTopTerms(topPosts),
    filter: {
      rawCandidates,
      kept: topPosts.length,
      droppedSpam,
      droppedBlocklistSub,
      droppedLowRelevance,
      minRelevanceRaw: 4
    },
    disclaimer:
      "Public search.json only — no OAuth. Searches use r/(Canada geo union)/search?restrict_sr=on plus post filters. Append subs with env REDDIT_CANADA_GEO_SUBS (comma-separated). Tune lists and scoring in server/redditCanadaRetailPulse.ts."
  };

  cache = { expires: Date.now() + CACHE_TTL_MS, body };
  return body;
}
