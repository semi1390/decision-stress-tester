import OpenAI from "openai";

/**
 * Qwen client over its OpenAI-compatible endpoint.
 *
 * Configuration (all via env — see .env.example):
 *   QWEN_API_KEY        the API key (falls back to DASHSCOPE_API_KEY / BITGET_QWEN_API_KEY)
 *   QWEN_BASE_URL       OpenAI-compatible base URL
 *                       - default: Bitget hackathon proxy (where S2 credits live)
 *                       - DashScope intl: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *   QWEN_MODEL          model id (default: qwen3.8-max)
 */

const API_KEY =
  process.env.QWEN_API_KEY ??
  process.env.DASHSCOPE_API_KEY ??
  process.env.BITGET_QWEN_API_KEY ??
  "";

const BASE_URL = process.env.QWEN_BASE_URL ?? "https://hackathon.bitgetops.com/v1";
const MODEL = process.env.QWEN_MODEL ?? "qwen3.8-max";

export function qwenConfigured(): boolean {
  return API_KEY.length > 0;
}

export function qwenMeta() {
  return { model: MODEL, baseUrl: BASE_URL };
}

function client(): OpenAI {
  if (!API_KEY) {
    throw new Error(
      "Qwen API key not set. Add QWEN_API_KEY (or DASHSCOPE_API_KEY) to .env.local — see README.",
    );
  }
  return new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
}

/** Single-shot chat completion → trimmed text. */
export async function qwenText(
  system: string,
  user: string,
  opts: { temperature?: number } = {},
): Promise<string> {
  const started = Date.now();
  try {
    const res = await client().chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    console.log(`[qwen] chat ok · model=${res.model || MODEL} · ${Date.now() - started}ms`);
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    console.error(`[qwen] chat FAILED · model=${MODEL} · ${Date.now() - started}ms · ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

/** Chat completion constrained to JSON, parsed defensively. */
export async function qwenJson<T>(system: string, user: string): Promise<T> {
  const text = await qwenText(
    `${system}\nReturn ONLY minified JSON. No markdown, no code fences, no prose.`,
    user,
    { temperature: 0 },
  );
  return parseJsonLoose<T>(text);
}

/** Tolerate code fences / stray prose around the JSON object. */
function parseJsonLoose<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}