import { headers } from "next/headers";

/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * NOT a substitute for an edge/CDN rate-limit on hot public routes — but
 * useful as a defence-in-depth cap for endpoints that hit Stripe / DB on
 * every request (e.g. `/p/[ref]` short-link redirector). State is per
 * Node process; in production behind multiple replicas the effective cap
 * is `limit × replicas`, which is acceptable for this use case (we just
 * want to stop a single source from grinding through references / hitting
 * Stripe a thousand times a second).
 */

type Bucket = { resetAt: number; count: number };

const BUCKETS = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

function clientIpFrom(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  const fromXff = xff?.split(",")[0]?.trim();
  return (
    fromXff ||
    h.get("x-real-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    "0.0.0.0"
  );
}

function gcIfNeeded(now: number) {
  if (BUCKETS.size < MAX_TRACKED_KEYS) return;
  for (const [k, b] of BUCKETS) {
    if (b.resetAt <= now) {
      BUCKETS.delete(k);
    }
  }
}

export type FixedWindowResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function fixedWindowHit(args: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): FixedWindowResult {
  const now = args.now ?? Date.now();
  const compositeKey = `${args.scope}:${args.key}`;
  const existing = BUCKETS.get(compositeKey);
  if (!existing || existing.resetAt <= now) {
    BUCKETS.set(compositeKey, { resetAt: now + args.windowMs, count: 1 });
    gcIfNeeded(now);
    return { allowed: true, remaining: args.limit - 1, retryAfterSec: 0 };
  }
  if (existing.count >= args.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: args.limit - existing.count,
    retryAfterSec: 0,
  };
}

/** Convenience wrapper that pulls the client IP from the current request. */
export async function fixedWindowHitByIp(args: {
  scope: string;
  limit: number;
  windowMs: number;
}): Promise<FixedWindowResult> {
  const h = await headers();
  return fixedWindowHit({
    scope: args.scope,
    key: clientIpFrom(h),
    limit: args.limit,
    windowMs: args.windowMs,
  });
}
