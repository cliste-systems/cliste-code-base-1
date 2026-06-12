import { createAdminClient } from "@/utils/supabase/admin";

import { rateLimitFingerprint } from "@/lib/auth-rate-limit";

export type VoiceApiRateLimitScope = "voice_preview" | "greeting_review";

const CONFIG: Record<
  VoiceApiRateLimitScope,
  { windowMs: number; maxRequests: number; eventType: string }
> = {
  voice_preview: {
    windowMs: 60_000,
    maxRequests: 20,
    eventType: "voice_preview_request",
  },
  greeting_review: {
    windowMs: 60_000,
    maxRequests: 5,
    eventType: "voice_greeting_rate_limited",
  },
};

export type VoiceApiRateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
};

async function countRequests(
  scope: VoiceApiRateLimitScope,
  actorKey: string,
): Promise<{ count: number; windowStartMs: number | null }> {
  const cfg = CONFIG[scope];
  const windowStart = new Date(Date.now() - cfg.windowMs).toISOString();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("security_auth_events")
      .select("created_at")
      .eq("event_type", cfg.eventType)
      .gte("created_at", windowStart)
      .contains("metadata", { voice_api_actor: actorKey })
      .order("created_at", { ascending: true })
      .limit(cfg.maxRequests + 1);
    if (error) {
      console.warn("[voice-api-rate-limit] count failed", error.message);
      return { count: 0, windowStartMs: null };
    }
    const rows = data ?? [];
    const first = rows[0]?.created_at;
    return {
      count: rows.length,
      windowStartMs: first ? new Date(first).getTime() : null,
    };
  } catch (e) {
    console.warn("[voice-api-rate-limit] count failed", e);
    return { count: 0, windowStartMs: null };
  }
}

export async function getVoiceApiRateLimitStatus(
  scope: VoiceApiRateLimitScope,
  fingerprint: string,
): Promise<VoiceApiRateLimitStatus> {
  const cfg = CONFIG[scope];
  const { count, windowStartMs } = await countRequests(scope, fingerprint);
  if (count < cfg.maxRequests) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = windowStartMs
    ? Math.max(
        1,
        Math.ceil((windowStartMs + cfg.windowMs - Date.now()) / 1000),
      )
    : 60;
  return { allowed: false, retryAfterSeconds };
}

export async function recordVoiceApiRequest(
  scope: VoiceApiRateLimitScope,
  fingerprint: string,
): Promise<void> {
  const cfg = CONFIG[scope];
  try {
    const admin = createAdminClient();
    await admin.from("security_auth_events").insert({
      event_type: cfg.eventType,
      outcome: "success",
      metadata: { voice_api_actor: fingerprint, voice_api_scope: scope },
    });
  } catch (e) {
    console.warn("[voice-api-rate-limit] record failed", e);
  }
}

export function voiceApiFingerprint(
  headersList: Headers,
  hint: string,
): string {
  return rateLimitFingerprint(headersList, hint);
}

export function voiceApiRateLimitMessage(retryAfterSeconds: number): string {
  return `Too many requests. Try again in ${retryAfterSeconds} seconds.`;
}
