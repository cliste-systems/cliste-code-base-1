import { createHash } from "crypto";

import { getTrustedClientIp } from "@/lib/trusted-client-ip";
import { createAdminClient } from "@/utils/supabase/admin";

type Scope = "authenticate" | "admin_login" | "dashboard_unlock";

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
  admin_login: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 5,
    lockMs: 30 * 60 * 1000,
    captchaAfterFailures: 1,
    eventTypes: ["admin_login"],
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
  const configured = process.env.AUTH_RATE_LIMIT_SALT?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_RATE_LIMIT_SALT must be set in production for pseudonymous IP hashing.",
    );
  }
  return DEFAULT_SALT;
}

export function hashRateLimitIdentifier(raw: string): string {
  return createHash("sha256")
    .update(`${getSalt()}:${raw}`)
    .digest("hex");
}

/** IP-only fingerprint for per-IP throttling. */
export function rateLimitFingerprint(
  headersList: Headers,
  hint?: string | null,
): string {
  const ip = getTrustedClientIp(headersList);
  const extra = hint?.trim() ? `:${hint.trim().toLowerCase()}` : "";
  return hashRateLimitIdentifier(`${ip}${extra}`);
}

/** Identifier-only fingerprint (email, etc.) — no IP or user-agent. */
export function rateLimitIdentifierFingerprint(identifier: string): string {
  return hashRateLimitIdentifier(identifier.trim().toLowerCase());
}

function scopeSeconds(cfg: ScopeConfig) {
  return {
    windowSeconds: Math.ceil(cfg.windowMs / 1000),
    lockSeconds: Math.ceil(cfg.lockMs / 1000),
  };
}

function toStatus(row: {
  failure_count: number;
  locked_until: string | null;
  retry_after_seconds: number;
  requires_captcha: boolean;
}): RateLimitStatus {
  const locked =
    row.retry_after_seconds > 0 ||
    (row.locked_until != null && new Date(row.locked_until).getTime() > Date.now());
  return {
    allowed: !locked,
    requiresCaptcha: row.requires_captcha,
    retryAfterSeconds: row.retry_after_seconds ?? 0,
    failuresInWindow: row.failure_count ?? 0,
  };
}

async function rpcStatus(
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  const cfg = CONFIG[scope];
  const { windowSeconds, lockSeconds } = scopeSeconds(cfg);
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auth_rate_limit_get_status", {
      p_scope: scope,
      p_fingerprint: fingerprint,
      p_window_seconds: windowSeconds,
      p_max_failures: cfg.maxFailures,
      p_lock_seconds: lockSeconds,
      p_captcha_after: cfg.captchaAfterFailures,
    });
    if (error) {
      console.warn("[auth-rate-limit] status rpc failed", error.message);
      return {
        allowed: true,
        requiresCaptcha: false,
        retryAfterSeconds: 0,
        failuresInWindow: 0,
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        allowed: true,
        requiresCaptcha: false,
        retryAfterSeconds: 0,
        failuresInWindow: 0,
      };
    }
    return toStatus(row as {
      failure_count: number;
      locked_until: string | null;
      retry_after_seconds: number;
      requires_captcha: boolean;
    });
  } catch (e) {
    console.warn("[auth-rate-limit] status failed", e);
    return {
      allowed: true,
      requiresCaptcha: false,
      retryAfterSeconds: 0,
      failuresInWindow: 0,
    };
  }
}

export async function getRateLimitStatus(
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  return rpcStatus(scope, fingerprint);
}

export async function recordRateLimitFailure(
  scope: Scope,
  fingerprint: string,
): Promise<RateLimitStatus> {
  const cfg = CONFIG[scope];
  const { windowSeconds, lockSeconds } = scopeSeconds(cfg);
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auth_rate_limit_record_failure", {
      p_scope: scope,
      p_fingerprint: fingerprint,
      p_window_seconds: windowSeconds,
      p_max_failures: cfg.maxFailures,
      p_lock_seconds: lockSeconds,
      p_captcha_after: cfg.captchaAfterFailures,
    });
    if (error) {
      console.warn("[auth-rate-limit] record rpc failed", error.message);
      return rpcStatus(scope, fingerprint);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return rpcStatus(scope, fingerprint);
    return toStatus(row as {
      failure_count: number;
      locked_until: string | null;
      retry_after_seconds: number;
      requires_captcha: boolean;
    });
  } catch (e) {
    console.warn("[auth-rate-limit] record failed", e);
    return rpcStatus(scope, fingerprint);
  }
}

export async function clearRateLimit(
  scope: Scope,
  fingerprint: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("auth_rate_limit_clear", {
      p_scope: scope,
      p_fingerprint: fingerprint,
    });
  } catch (e) {
    console.warn("[auth-rate-limit] clear failed", e);
  }
}
