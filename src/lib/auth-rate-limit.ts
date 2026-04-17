import { createHash } from "crypto";

type Scope = "authenticate" | "admin_unlock" | "dashboard_unlock";

type Bucket = {
  firstFailureMs: number;
  failureCount: number;
  lockedUntilMs: number;
};

type ScopeConfig = {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  captchaAfterFailures: number;
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
  },
  admin_unlock: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 5,
    lockMs: 30 * 60 * 1000,
    captchaAfterFailures: 1,
  },
  dashboard_unlock: {
    windowMs: 15 * 60 * 1000,
    maxFailures: 8,
    lockMs: 15 * 60 * 1000,
    captchaAfterFailures: 3,
  },
};

const BUCKETS = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

function key(scope: Scope, fingerprint: string): string {
  return `${scope}:${fingerprint}`;
}

function getSalt(): string {
  return process.env.AUTH_RATE_LIMIT_SALT?.trim() || DEFAULT_SALT;
}

export function hashRateLimitIdentifier(raw: string): string {
  return createHash("sha256")
    .update(`${getSalt()}:${raw}`)
    .digest("hex");
}

function getClientIp(headersList: Headers): string {
  const xff = headersList.get("x-forwarded-for");
  const fromXff = xff?.split(",")[0]?.trim();
  const fromRealIp = headersList.get("x-real-ip")?.trim();
  const fromCf = headersList.get("cf-connecting-ip")?.trim();
  return fromXff || fromRealIp || fromCf || "0.0.0.0";
}

export function rateLimitFingerprint(
  headersList: Headers,
  hint?: string | null
): string {
  const ip = getClientIp(headersList);
  const ua = headersList.get("user-agent")?.trim() || "unknown-ua";
  const extra = hint?.trim() ? `:${hint.trim().toLowerCase()}` : "";
  return hashRateLimitIdentifier(`${ip}:${ua}${extra}`);
}

function purgeExpired(scope: Scope, bucketKey: string, t: number): Bucket | null {
  const cfg = CONFIG[scope];
  const existing = BUCKETS.get(bucketKey);
  if (!existing) return null;
  if (existing.lockedUntilMs > 0 && existing.lockedUntilMs > t) return existing;
  if (t - existing.firstFailureMs > cfg.windowMs) {
    BUCKETS.delete(bucketKey);
    return null;
  }
  if (existing.lockedUntilMs > 0 && existing.lockedUntilMs <= t) {
    BUCKETS.delete(bucketKey);
    return null;
  }
  return existing;
}

export function getRateLimitStatus(
  scope: Scope,
  fingerprint: string
): RateLimitStatus {
  const cfg = CONFIG[scope];
  const t = nowMs();
  const bucketKey = key(scope, fingerprint);
  const b = purgeExpired(scope, bucketKey, t);
  if (!b) {
    return {
      allowed: true,
      requiresCaptcha: false,
      retryAfterSeconds: 0,
      failuresInWindow: 0,
    };
  }
  const locked = b.lockedUntilMs > t;
  const retryAfterSeconds = locked
    ? Math.max(1, Math.ceil((b.lockedUntilMs - t) / 1000))
    : 0;
  return {
    allowed: !locked,
    requiresCaptcha: b.failureCount >= cfg.captchaAfterFailures,
    retryAfterSeconds,
    failuresInWindow: b.failureCount,
  };
}

export function recordRateLimitFailure(
  scope: Scope,
  fingerprint: string
): RateLimitStatus {
  const cfg = CONFIG[scope];
  const t = nowMs();
  const bucketKey = key(scope, fingerprint);
  const existing = purgeExpired(scope, bucketKey, t);
  const failureCount = (existing?.failureCount ?? 0) + 1;
  const firstFailureMs =
    existing && t - existing.firstFailureMs <= cfg.windowMs
      ? existing.firstFailureMs
      : t;
  const lockedUntilMs =
    failureCount >= cfg.maxFailures ? t + cfg.lockMs : existing?.lockedUntilMs ?? 0;
  BUCKETS.set(bucketKey, {
    firstFailureMs,
    failureCount,
    lockedUntilMs,
  });
  return getRateLimitStatus(scope, fingerprint);
}

export function clearRateLimit(scope: Scope, fingerprint: string): void {
  BUCKETS.delete(key(scope, fingerprint));
}
