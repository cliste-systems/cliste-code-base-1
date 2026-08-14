import { hashRateLimitIdentifier } from "@/lib/auth-rate-limit";
import { getTrustedClientIp, maskIpForLog } from "@/lib/trusted-client-ip";
import { createAdminClient } from "@/utils/supabase/admin";

export type SecurityEventContext = {
  ipHash: string | null;
  ipMasked: string | null;
  ipCountry: string | null;
  userAgent: string | null;
};

export type SecurityEventPayload = {
  eventType: string;
  outcome: "success" | "failure" | "rate_limited" | "config_error";
  actorUserId?: string | null;
  actorEmail?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  loginEmail?: string | null;
  attemptCount?: number | null;
  metadata?: Record<string, unknown>;
};

export function buildSecurityEventContext(headersList: Headers): SecurityEventContext {
  const ip = getTrustedClientIp(headersList);
  return {
    ipHash: ip && ip !== "0.0.0.0" ? hashRateLimitIdentifier(`security-ip:${ip}`) : null,
    ipMasked: maskIpForLog(ip),
    ipCountry: headersList.get("cf-ipcountry")?.trim() || null,
    userAgent: headersList.get("user-agent")?.trim() || null,
  };
}

export async function logSecurityEvent(
  ctx: SecurityEventContext,
  payload: SecurityEventPayload
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("security_auth_events").insert({
      event_type: payload.eventType,
      outcome: payload.outcome,
      actor_user_id: payload.actorUserId ?? null,
      actor_email: payload.actorEmail?.trim().toLowerCase() ?? null,
      target_user_id: payload.targetUserId ?? null,
      target_email: payload.targetEmail?.trim().toLowerCase() ?? null,
      login_email: payload.loginEmail?.trim().toLowerCase() ?? null,
      ip_hash: ctx.ipHash,
      ip_masked: ctx.ipMasked,
      ip_country: ctx.ipCountry,
      user_agent: ctx.userAgent,
      attempt_count: payload.attemptCount ?? null,
      metadata: payload.metadata ?? {},
    });
    if (error) {
      console.warn("[security] failed_to_write_security_event", {
        reason: error.message,
        eventType: payload.eventType,
      });
    }
  } catch (e) {
    console.warn("[security] failed_to_write_security_event", {
      reason: e instanceof Error ? e.message : "unknown",
      eventType: payload.eventType,
    });
  }
}
