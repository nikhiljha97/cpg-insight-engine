/**
 * Lightweight sentiment for Canada retail pulse posts.
 * Lexicon polarity + hand-tuned logistic-style squash on relevance — prototype, not a fine-tuned transformer.
 */

const POS =
  /\b(great|good|better|deal|relief|finally|fair|reasonable|stable|dropped|cheaper|stocked|fresh|happy|win)\b/i;
const NEG =
  /\b(expensive|unaffordable|angry|ridiculous|shrinkflation|gouging|worst|brutal|insane|struggle|scam|outrage|robbery|criminal|disgusting|pathetic)\b/i;

/** Raw lexical signal in roughly [-1, 1]. */
export function lexicalPolarity(text: string): number {
  const t = text.slice(0, 800);
  let s = 0;
  if (NEG.test(t)) s -= 0.55;
  if (POS.test(t)) s += 0.45;
  if (NEG.test(t) && POS.test(t)) s *= 0.55;
  return Math.max(-1, Math.min(1, s));
}

/** Sigmoid for a single "neuron" over [lexical, relevanceNorm, negBoost]. */
function squash(z: number): number {
  return 2 / (1 + Math.exp(-z)) - 1;
}

export type PulsePostSentiment = {
  score: number;
  label: string;
  lexical: number;
  relevanceNorm: number;
};

export function scorePostSentiment(title: string, snippet: string, relevanceScore: number): PulsePostSentiment {
  const lexical = lexicalPolarity(`${title}\n${snippet}`);
  const relevanceNorm = Math.min(1, Math.max(0, relevanceScore / 22));
  const z = 1.15 * lexical + 0.55 * (relevanceNorm - 0.35) - 0.12;
  const score = Math.max(-1, Math.min(1, squash(z)));
  const label =
    score <= -0.22 ? "Stress-heavy" : score >= 0.22 ? "Relief-leaning" : "Mixed / neutral";
  return { score, label, lexical, relevanceNorm };
}

export type PulseAggregateSentiment = {
  meanScore: number;
  /** 0–100 convenience scale for dashboards */
  index0to100: number;
  label: string;
  methodology: string;
  sampleSize: number;
  /** Histogram buckets for transparency */
  buckets: { stressHeavy: number; mixed: number; reliefLeaning: number };
};

export function aggregatePulseSentiment(
  scores: number[]
): PulseAggregateSentiment {
  const n = scores.length;
  if (!n) {
    return {
      meanScore: 0,
      index0to100: 50,
      label: "No scored posts",
      methodology:
        "Lexicon + logistic-style blend on title/snippet, weighted by grocery relevance (prototype; not NLP-grade).",
      sampleSize: 0,
      buckets: { stressHeavy: 0, mixed: 0, reliefLeaning: 0 },
    };
  }
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;
  const index0to100 = Math.round(((meanScore + 1) / 2) * 100);
  let stressHeavy = 0;
  let mixed = 0;
  let reliefLeaning = 0;
  for (const s of scores) {
    if (s <= -0.22) stressHeavy += 1;
    else if (s >= 0.22) reliefLeaning += 1;
    else mixed += 1;
  }
  const label =
    meanScore <= -0.12 ? "Net stress signal" : meanScore >= 0.12 ? "Net relief signal" : "Balanced tone";
  return {
    meanScore,
    index0to100,
    label,
    methodology:
      "Per-post: lexicon polarity (grocery/price language) + relevance-aware logistic squash; aggregate: unweighted mean over kept posts. Heuristic ensemble — not a trained ML model.",
    sampleSize: n,
    buckets: { stressHeavy, mixed, reliefLeaning },
  };
}
