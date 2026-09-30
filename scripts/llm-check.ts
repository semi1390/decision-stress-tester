/* Live Qwen check — run with:  npm run llm-check
 * Loads .env.local, fires ONE real Qwen chat call, and prints the reply + model
 * + latency. Proves the key works and the LLM genuinely responds (no mocks). */

import { readFileSync } from "node:fs";
import OpenAI from "openai";

// Load .env.local
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) {
      const k = m[1];
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(k in process.env)) process.env[k] = v;
    }
  }
} catch {
  // no .env.local — rely on shell env
}

const key =
  process.env.QWEN_API_KEY ||
  process.env.DASHSCOPE_API_KEY ||
  process.env.BITGET_QWEN_API_KEY ||
  "";

const baseURL =
  process.env.QWEN_BASE_URL ||
  "https://hackathon.bitgetops.com/v1";

const model =
  process.env.QWEN_MODEL ||
  "qwen3.8-max";

console.log("──────────────────────────────────────────────");
console.log(
  `API key:  ${
    key
      ? `present (${key.slice(0, 6)}…, ${key.length} chars)`
      : "MISSING"
  }`
);
console.log(`Base URL: ${baseURL}`);
console.log(`Model:    ${model}`);
console.log("──────────────────────────────────────────────");

if (!key) {
  console.error(
    "❌ No QWEN_API_KEY / DASHSCOPE_API_KEY found in .env.local or env."
  );
  process.exit(1);
}

const client = new OpenAI({
  apiKey: key,
  baseURL,
});

async function main() {
  const t = Date.now();

  try {
    const r = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content:
            "In one short sentence, confirm you are a live Qwen model responding right now.",
        },
      ],
    });

    console.log(`\n✅ LIVE — Qwen responded in ${Date.now() - t}ms`);
    console.log(`   model returned: ${r.model}`);
    console.log(
      `   reply: ${r.choices[0]?.message?.content?.trim()}`
    );
    console.log(`   usage: ${JSON.stringify(r.usage)}`);
  } catch (e: any) {
    console.error(
      `\n❌ Qwen call FAILED in ${Date.now() - t}ms`
    );
    console.error(
      `   ${e?.status ? `HTTP ${e.status} · ` : ""}${e?.message || e}`
    );
    console.error(
      "   → The AI is NOT working. Check the key, base URL, and model above."
    );
    process.exit(1);
  }
}

main();