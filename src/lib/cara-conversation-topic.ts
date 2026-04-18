import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveOpenRouterBase } from "@/lib/llm-base";

const MAX_TITLE_LEN = 72;

/** Openers that shouldn’t become the sidebar label (e.g. “hi”). */
export function isTrivialUserOpening(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 2) return true;
  if (
    /^(hi|hey|hello|hiya|yo|sup|howdy|thanks?|thx|ok|okay|test|hola|cheers)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (t.length <= 20 && /^(good\s+(morning|afternoon|evening))[\s!.?]*$/i.test(t)) {
    return true;
  }
  return false;
}

/** Looks like a pasted chat line / typo slug, not a sidebar label. */
function looksLikeRawChatSlug(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t.length > 56) return false;

  if (/\?/.test(t)) return true;
  if (
    /^(what|how|when|why|where|who|whats|what's|can|could|would|should|is|are|tell|show|give|cancel|delete|remove|book|hi|hey)\b/i.test(
      t,
    ) &&
    t.length < 64
  ) {
    return true;
  }

  if (/^[a-z]/.test(t) && t.split(/\s+/).length <= 10 && t.length < 52) {
    return true;
  }

  if (t.length < 14 && !/\s/.test(t)) return true;

  return false;
}

/** When to replace title with an LLM-derived topic (covers legacy “hi” rows). */
export function shouldRegenerateTopicTitle(title: string | null | undefined): boolean {
  if (title == null) return true;
  const t = title.trim();
  if (!t) return true;
  if (isTrivialUserOpening(t)) return true;
  if (looksLikeRawChatSlug(t)) return true;
  return false;
}

function sanitizeTopicLabel(raw: string): string | null {
  let s = raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\.+$/g, "")
    .trim();
  s = s.replace(/\s+/g, " ");
  if (!s) return null;
  const oneLine = s.split(/\r?\n/)[0]!.trim();
  if (!oneLine) return null;
  if (oneLine.length > MAX_TITLE_LEN) {
    return `${oneLine.slice(0, MAX_TITLE_LEN - 1)}…`;
  }
  return oneLine;
}

async function fetchTopicLabelFromLlm(
  userLine: string,
  assistantReply: string,
): Promise<string | null> {
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  const oaKey = process.env.OPENAI_API_KEY?.trim();
  const apiKey = orKey || oaKey;
  if (!apiKey) return null;

  const useOpenRouter = Boolean(orKey);
  const url = useOpenRouter
    ? resolveOpenRouterBase()
    : "https://api.openai.com/v1/chat/completions";
  const model = useOpenRouter
    ? process.env.CARA_OPENROUTER_MODEL?.trim() ||
      "google/gemini-2.5-flash-lite"
    : process.env.CARA_OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const system =
    "You write the sidebar title for one salon staff ↔ Cara (AI) chat. Reply with ONLY a polished topic phrase: 4–7 words, title-style wording, no quotes or emojis, no trailing period. " +
    "Never echo typos, slang fragments, or command stubs (e.g. not “Cancel App”, not “What Was Sales”). " +
    "Infer the real topic (e.g. “Two-week booking performance”, “Cancelling a midweek visit”, “Reception call volume”).";

  const userPayload = [
    "Staff message:",
    userLine.slice(0, 420),
    "",
    "Assistant reply (excerpt):",
    assistantReply.slice(0, 720),
  ].join("\n");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (useOpenRouter) {
    headers["X-Title"] = "Cliste Cara topic label";
    const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
    if (referer) headers["HTTP-Referer"] = referer;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 48,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPayload },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  return sanitizeTopicLabel(raw);
}

/**
 * Sets a human-readable topic title when the current one is missing or too thin
 * (e.g. “hi”). Runs after Cara’s reply so the model sees both sides.
 */
export async function refreshConversationTopicTitleAfterReply(
  supabase: SupabaseClient,
  conversationId: string,
  userLine: string,
  assistantReply: string,
): Promise<void> {
  const { data: conv, error } = await supabase
    .from("cara_conversations")
    .select("title")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conv) return;

  if (!shouldRegenerateTopicTitle(conv.title as string | null)) return;

  const label = await fetchTopicLabelFromLlm(userLine, assistantReply);
  if (!label) return;

  await supabase
    .from("cara_conversations")
    .update({ title: label })
    .eq("id", conversationId);
}
