import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";

export type TextRehearsalVariantCount = 5 | 10 | 20;

export async function generateTextRehearsalVariants(input: {
  seed: string;
  count: TextRehearsalVariantCount;
}): Promise<string[]> {
  const seed = input.seed.trim();
  if (!seed) {
    throw new Error("Enter what a caller might say before generating variants.");
  }

  const raw = await completeOpenRouterChat({
    temperature: 0.85,
    maxTokens: 2048,
    messages: [
      {
        role: "system",
        content: `You help QA a supermarket phone AI. Given one caller phrase, produce ${input.count} distinct natural rephrasings Irish/UK customers might use on a real call.

Rules:
- Keep the same intent as the seed (do not change topic).
- Mix formal/casual, short/long, polite/direct, partial sentences, typos-lite (not absurd).
- Include at least 2 very short variants (1–4 words) if possible.
- Do not answer the question — only rephrase how a caller would ask/say it.
- Return JSON: { "variants": string[] } with exactly ${input.count} strings.`,
      },
      {
        role: "user",
        content: `Seed caller phrase:\n${seed}`,
      },
    ],
  });

  let parsed: { variants?: unknown };
  try {
    parsed = JSON.parse(raw) as { variants?: unknown };
  } catch {
    throw new Error("AI returned invalid JSON for variants.");
  }

  const variants = Array.isArray(parsed.variants)
    ? parsed.variants
        .map((line) => (typeof line === "string" ? line.trim() : ""))
        .filter(Boolean)
    : [];

  if (variants.length === 0) {
    throw new Error("AI returned no variants.");
  }

  const unique = [...new Set([seed, ...variants])];
  return unique.slice(0, input.count);
}
