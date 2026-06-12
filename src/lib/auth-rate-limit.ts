import { createHash } from "crypto";

import { createAdminClient } from "@/utils/supabase/admin";

type Scope = "authenticate" | "admin_unlock" | "dashboard_unlock";

type ScopeConfig = {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  captchaAfterFailures: number;
  eventTypes: string[];
};

export type RateLimitStatus = {
  allowed: boolean;
  requiresCaptcha: boolean;
  retryAfterSeconds: number;
  failuresInWindow: number;
};

const DEFAULT_SALT = "cliste-auth-rate-limit-dev";

const CONFIG: Record<Scope, ScopeConfig> = {
  authenticate: {
    windowMs: 10 * 60 * 1000,
    maxFailures: 6,
    lockMs: 15 * 60 * 1000,
    captchaAfterFailures: 2,
    eventTypes: ["auth_password_sign_in", "auth_signup"],
  },
  admin_unlock: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 5,
    lockMs: 30 * 60 * 1000,
    captchaAfterFailures: 1,
    eventTypes: ["admin_unlock"],
  },
  dashboard_unlock: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 8,
    lockMs: 15 * 60 * 1000,
    captchaAfterFailures: 3,
    eventTypes: ["dashboard_unlock"],
  },
};

function getSalt(): string {
  return process.env.AUTH_RATE_LIMIT_SALT?.trim() || DEFAULT_SALT;
}

export function hashRateLimitIdentifier(raw: string): string {
  return createHash("sha256")
    .update(`${getSalt()}:${raw}`)
    .digest("hex");
}

function getClientIp(headersList: Headers): string {
  const fromCf = headersList.get("cf-connecting-ip")?.trim();
  if (fromCf) return fromCf;
  const fromRealIp = headersList.get("x-real-ip")?.trim();
  if (fromRealIp) return fromRealIp;
  const xff = headersList.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }
  return "0.0.0.0";
}

export function rateLimitFingerprint(
  headersList: Headers,
  hint?: string | null,
): string {
  const ip = getClientIp(headersList);
  const ua = headersList.get("user-agent")?.trim() || "unknown-ua";
  const extra = hint?.trim() ? `:${hint.trim().toLowerCase()}` : "";
  return hashRateLimitIdentifier(`${ip}:${ua}${extra}`);
}

async function countFailures(
  scope: Scope,
  fingerprint: string,
): Promise<{ count: number; lastFailureMs: number | null }> {
  const cfg = CONFIG[scope];
  const windowStart = new Date(Date.now() - cfg.windowMs).toISOString();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("security_auth_events")
      .select("created_at")
      .in("event_type", cfg.eventTypes)
      .in("outcome", ["failure", "rate_limited"])
      .gte("created_at", windowStart)
      .contains("metadata", { rate_limit_fingerprint: fingerprint })
      .order("created_at", { ascending: false })
      .limit(cfg.maxFailures + 1);
    if (error) {
      console.warn("[auth-rate-limit] count query failed", error.message);
      return { count: 0, lastFailureMs: null };
    }
    const rows = data ?? [];
    const last = rows[0]?.created_at;
    return {
      count: rows.length,
      lastFailureMs: last ? new Date(last).getTime() : null,
    };
  } catch (e) {
    console.warn("[auth-rate-limit] count failed", e);
    return { count: 0, lastFailureMs: null };
  }
}

export async function getRateLimitStatus(
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  const cfg = CONFIG[scope];
  const { count, lastFailureMs } = await countFailures(scope, fingerprint);
  const locked =
    count >= cfg.maxFailures &&
    lastFailureMs != null &&
    Date.now() < lastFailureMs + cfg.lockMs;
  const retryAfterSeconds = locked
    ? Math.max(1, Math.ceil((lastFailureMs! + cfg.lockMs - Date.now()) / 1000))
    : 0;
  return {
    allowed: !locked,
    requiresCaptcha: count >= cfg.captchaAfterFailures,
    retryAfterSeconds,
    failuresInWindow: count,
  };
}

export async function recordRateLimitFailure(
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  const cfg = CONFIG[scope];
  try {
    const admin = createAdminClient();
    await admin.from("security_auth_events").insert({
      event_type: cfg.eventTypes[0],
      outcome: "failure",
      metadata: { rate_limit_fingerprint: fingerprint, rate_limit_only: true },
    });
  } catch (e) {
    console.warn("[auth-rate-limit] record failure failed", e);
  }
  return getRateLimitStatus(scope, fingerprint);
}

export async function clearRateLimit(
  scope: Scope,
  fingerprint: string,
): Promise<void> {
  const cfg = CONFIG[scope];
  try {
    const admin = createAdminClient();
    await admin
      .from("security_auth_events")
      .delete()
      .in("event_type", cfg.eventTypes)
      .contains("metadata", {
        rate_limit_fingerprint: fingerprint,
        rate_limit_only: true,
      });
  } catch (e) {
    console.warn("[auth-rate-limit] clear failed", e);
  }
}
