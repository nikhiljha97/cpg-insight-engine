import Groq from "groq-sdk";
import { z } from "zod";
import { buildMacroStrip } from "./macroStrip.js";

export type NlqBarLineChart = {
  type: "bar" | "line";
  labels: string[];
  values: number[];
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
};

export type NlqCardChart = {
  type: "card";
  headline: string;
  detail?: string;
};

export type NlqChart = NlqBarLineChart | NlqCardChart;

const chartBarLine = z.object({
  type: z.enum(["bar", "line"]),
  labels: z.array(z.string()),
  values: z.array(z.number()),
  valuePrefix: z.string().optional(),
  valueSuffix: z.string().optional(),
  decimals: z.number().optional(),
});

const chartCard = z.object({
  type: z.literal("card"),
  headline: z.string(),
  detail: z.string().optional(),
});

const chartSchema = z.union([chartBarLine, chartCard]);

const nlqModelOut = z.object({
  reply: z.string(),
  chart: z.union([chartSchema, z.null()]).optional(),
});

function sanitizeChart(raw: unknown): NlqChart | null {
  const bar = chartBarLine.safeParse(raw);
  if (bar.success && bar.data.labels.length === bar.data.values.length && bar.data.labels.length > 0) {
    return bar.data;
  }
  const card = chartCard.safeParse(raw);
  if (card.success) return card.data;
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated]`;
}

export function buildNlqDataContext(
  unified: Record<string, unknown> | null,
  ontarioTrail: Array<{ period: string; value: number }>,
  city?: string
): string {
  const parts: string[] = [];
  if (city) parts.push(`User-selected dashboard city: ${city}`);
  parts.push("=== MACRO (retail_analytics in unified_signal) ===\n" + JSON.stringify(buildMacroStrip(unified), null, 2));
  parts.push("=== ONTARIO TOTAL RETAIL (millions CAD, trail) ===\n" + JSON.stringify(ontarioTrail, null, 2));

  if (unified) {
    const meta = unified.meta as Record<string, unknown> | undefined;
    parts.push(
      "=== UNIFIED META ===\n" +
        JSON.stringify(
          {
            last_updated: meta?.last_updated,
            datasets_used: meta?.datasets_used,
          },
          null,
          2
        )
    );

    const basket = unified.basket_analysis as Record<string, unknown> | undefined;
    const companions = (basket?.soup_companions as unknown[])?.slice(0, 14) ?? [];
    parts.push("=== SOUP COMPANIONS ===\n" + JSON.stringify(companions, null, 2));
    const pairs = (basket?.top_cross_dept_pairs as unknown[])?.slice(0, 10) ?? [];
    parts.push("=== TOP CROSS-DEPT PAIRS ===\n" + JSON.stringify(pairs, null, 2));

    const promo = unified.promo_attribution;
    parts.push("=== PROMO ATTRIBUTION (truncated JSON) ===\n" + truncate(JSON.stringify(promo ?? {}, null, 2), 6000));

    const el = unified.price_elasticity;
    parts.push("=== PRICE ELASTICITY (truncated JSON) ===\n" + truncate(JSON.stringify(el ?? {}, null, 2), 5000));

    const demo = unified.demographics;
    parts.push("=== DEMOGRAPHICS (truncated JSON) ===\n" + truncate(JSON.stringify(demo ?? {}, null, 2), 5000));
  }

  return truncate(parts.join("\n\n"), 28000);
}

export async function nlqChatCompletion(
  apiKey: string,
  dataContext: string,
  conversation: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ reply: string; chart: NlqChart | null }> {
  let trimmed = conversation
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 12000),
    }))
    .slice(-16);

  while (trimmed.length && trimmed[0]!.role === "assistant") trimmed.shift();

  const systemContent = `You are an interactive retail analytics copilot for Canadian grocery / CPG use cases.

Output rules (critical):
- Respond with a single JSON object only (no markdown fences, no prose outside JSON).
- Keys: "reply" (string, Markdown allowed inside the string) and "chart" (either null or a chart object).
- Ground claims in the DATA CONTEXT. If something is not in the data, say so and suggest which dashboard tab might help.
- Keep "reply" focused: default to roughly 120–350 words unless the user explicitly asks for exhaustive detail.
- Use "chart" sparingly: only when a simple bar, line, or headline card makes the answer materially clearer. Chart shapes:
  * {"type":"bar"|"line","labels":["…"],"values":[number,...], "valuePrefix":"$"|"", "valueSuffix":"%"|"", "decimals":0|1|2}
  * {"type":"card","headline":"text","detail":"optional subtitle"}
- labels and values must be parallel arrays of equal length (length >= 2 for bar/line).

DATA CONTEXT:
${dataContext}`;

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: systemContent }, ...trimmed],
    temperature: 0.35,
    max_tokens: 1800,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { reply: raw || "Could not parse model output.", chart: null };
  }

  const out = nlqModelOut.safeParse(parsed);
  if (!out.success) {
    return { reply: "The model returned an unexpected format. Please try rephrasing your question.", chart: null };
  }

  const chart = out.data.chart === undefined || out.data.chart === null ? null : sanitizeChart(out.data.chart);
  return { reply: out.data.reply.trim() || "No reply.", chart };
}
