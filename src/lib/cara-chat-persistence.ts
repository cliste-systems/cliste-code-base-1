import type { SupabaseClient } from "@supabase/supabase-js";

import { stripChatMarkdownDisplay } from "@/lib/cara-chat-display";
import { CARA_WELCOME_MESSAGE } from "@/lib/cara-chat-stub";

export const CARA_WELCOME_TEXT = CARA_WELCOME_MESSAGE.text;

export type CaraPersistedRole = "user" | "assistant";

export type CaraPersistedRow = {
  id: string;
  role: CaraPersistedRole;
  content: string;
  created_at: string;
};

export type CaraConversationListRow = {
  id: string;
  title: string | null;
  updated_at: string;
};

/** Detects missing Cara tables / PostgREST schema issues from error text. */
export function isCaraStorageUnavailableError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  if (!msg) return false;
  const m = msg.toLowerCase();
  if (
    m.includes("cara_conversations") ||
    m.includes("cara_messages") ||
    m.includes("cara_pending_actions")
  ) {
    return true;
  }
  if (
    (m.includes("does not exist") || m.includes("undefined table")) &&
    (m.includes("relation") || m.includes("table"))
  ) {
    return true;
  }
  if (m.includes("could not find the table")) return true;
  if (m.includes("schema cache")) return true;
  return false;
}

const OPENAI_HISTORY_CAP = 80;
const LIST_MESSAGES_CAP = 400;
const LIST_CONVERSATIONS_CAP = 25;
const DUBLIN_TZ = "Europe/Dublin";

function dublinDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function pickGreetingLine(lines: readonly string[], seed: number): string {
  if (lines.length === 0) return CARA_WELCOME_TEXT;
  return lines[Math.abs(seed) % lines.length] ?? CARA_WELCOME_TEXT;
}

function buildDynamicCaraWelcomeText(input: {
  priorConversationCount: number;
  hasConversationToday: boolean;
}): string {
  if (input.priorConversationCount <= 0) {
    return "Hey there 👋 I’m Cara — your salon manager sidekick. What are we sorting first today?";
  }

  if (input.hasConversationToday) {
    const options = [
      "Welcome back 👋 Ready for the next salon win?",
      "Back again — love it 👋 What are we tackling now?",
      "Hey, welcome back 👋 What needs sorting this round?",
    ] as const;
    return pickGreetingLine(options, Date.now());
  }

  const options = [
    "Welcome back 👋 Great to see you again. What are we sorting today?",
    "Hey again 👋 Ready to run through today’s salon priorities?",
    "Nice to have you back 👋 What do you want to tackle first?",
  ] as const;
  return pickGreetingLine(options, Date.now());
}

async function resolveCaraWelcomeText(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string> {
  const previous = await listRecentConversations(supabase, organizationId, userId);
  if (previous.length === 0) return CARA_WELCOME_TEXT;
  const todayKey = dublinDateKey(new Date());
  const hasConversationToday = previous.some((c) => {
    const when = new Date(c.updated_at);
    if (Number.isNaN(when.getTime())) return false;
    return dublinDateKey(when) === todayKey;
  });
  return buildDynamicCaraWelcomeText({
    priorConversationCount: previous.length,
    hasConversationToday,
  });
}

export async function getLatestConversationId(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cara_conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isCaraStorageUnavailableError(error.message)) {
      throw new Error(error.message);
    }
    return null;
  }
  if (!data?.id) return null;
  return data.id;
}

export async function createConversationWithWelcome(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<{ conversationId: string }> {
  const welcomeText = await resolveCaraWelcomeText(
    supabase,
    organizationId,
    userId
  );

  const { data: conv, error: cErr } = await supabase
    .from("cara_conversations")
    .insert({
      organization_id: organizationId,
      user_id: userId,
    })
    .select("id")
    .single();

  if (cErr || !conv?.id) {
    throw new Error(cErr?.message ?? "Failed to create conversation");
  }

  const { error: mErr } = await supabase.from("cara_messages").insert({
    conversation_id: conv.id,
    role: "assistant",
    content: welcomeText,
  });

  if (mErr) {
    await supabase.from("cara_conversations").delete().eq("id", conv.id);
    throw new Error(mErr.message);
  }

  await touchConversation(supabase, conv.id);
  return { conversationId: conv.id };
}

export async function ensureActiveConversationId(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<string> {
  const existing = await getLatestConversationId(
    supabase,
    organizationId,
    userId,
  );
  if (existing) return existing;
  const { conversationId } = await createConversationWithWelcome(
    supabase,
    organizationId,
    userId,
  );
  return conversationId;
}

export async function verifyConversationAccess(
  supabase: SupabaseClient,
  conversationId: string,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("cara_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function listRecentConversations(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<CaraConversationListRow[]> {
  const { data, error } = await supabase
    .from("cara_conversations")
    .select("id, title, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(LIST_CONVERSATIONS_CAP);

  if (error || !data) return [];
  return data as CaraConversationListRow[];
}

export async function deleteCaraConversationForUser(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  conversationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("cara_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: "Conversation not found." };
  return { ok: true };
}

export async function deleteAllCaraConversationsForUser(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("cara_conversations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return {};
}

export async function listMessagesAsc(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<CaraPersistedRow[]> {
  const { data, error } = await supabase
    .from("cara_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(LIST_MESSAGES_CAP);

  if (error || !data) return [];
  return data as CaraPersistedRow[];
}

export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await supabase
    .from("cara_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Adds an assistant line to this dashboard user’s latest Cara thread (Bookings / Calendar sync).
 * Never throws; ignores missing Cara schema so booking flows stay reliable.
 */
export async function appendCaraDiaryNoticeForDashboardUser(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  content: string,
): Promise<void> {
  const text = stripChatMarkdownDisplay(content.trim());
  if (!text) return;

  let conversationId: string;
  try {
    conversationId = await ensureActiveConversationId(
      supabase,
      organizationId,
      userId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isCaraStorageUnavailableError(msg)) {
      console.error("Cara diary notice: conversation", e);
    }
    return;
  }

  const { error } = await supabase.from("cara_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: text,
  });
  if (error) {
    if (!isCaraStorageUnavailableError(error.message)) {
      console.error("Cara diary notice: insert", error);
    }
    return;
  }

  await touchConversation(supabase, conversationId);
}

/**
 * Intentionally does not copy the user’s first line into `title` — raw questions
 * (“what was sales…”) look bad in the sidebar. Titles are set after Cara replies
 * via `refreshConversationTopicTitleAfterReply` (LLM short label), or stay empty
 * until then (`formatConvLabel` falls back to a date stamp).
 */
export async function maybeSetConversationTitleFromUserMessage(
  _supabase: SupabaseClient,
  _conversationId: string,
  _userContent: string,
): Promise<void> {}

export function sliceForOpenAi(
  rows: CaraPersistedRow[],
): { role: CaraPersistedRole; content: string }[] {
  const tail = rows.slice(-OPENAI_HISTORY_CAP);
  return tail.map((r) => ({
    role: r.role,
    content: r.content,
  }));
}

/** Client `CaraChatMessage` shape (role `cara` for assistant). */
export type CaraClientMessagePayload = {
  id: string;
  role: "cara" | "user";
  text: string;
};

export function rowsToClientPayload(
  rows: CaraPersistedRow[],
): CaraClientMessagePayload[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role === "assistant" ? "cara" : "user",
    text: r.content,
  }));
}
