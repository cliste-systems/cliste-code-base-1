import { rateLimitFingerprint } from "@/lib/auth-rate-limit";

export type VoiceApiRateLimitScope = "voice_preview" | "greeting_review";

type Bucket = {
  windowStartMs: number;
  count: number;
};

const CONFIG: Record<
  VoiceApiRateLimitScope,
  { windowMs: number; maxRequests: number }
> = {
  voice_preview: { windowMs: 60_000, maxRequests: 20 },
  greeting_review: { windowMs: 60_000, maxRequests: 5 },
};

const BUCKETS = new Map<string, Bucket>();

function bucketKey(scope: VoiceApiRateLimitScope, fingerprint: string): string {
  return `${scope}:${fingerprint}`;
}

export type VoiceApiRateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function getVoiceApiRateLimitStatus(
  scope: VoiceApiRateLimitScope,
  fingerprint: string,
): VoiceApiRateLimitStatus {
  const cfg = CONFIG[scope];
  const now = Date.now();
  const key = bucketKey(scope, fingerprint);
  const bucket = BUCKETS.get(key);

  if (!bucket || now - bucket.windowStartMs >= cfg.windowMs) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count < cfg.maxRequests) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.windowStartMs + cfg.windowMs - now) / 1000),
  );
  return { allowed: false, retryAfterSeconds };
}

export function recordVoiceApiRequest(
  scope: VoiceApiRateLimitScope,
  fingerprint: string,
): void {
  const cfg = CONFIG[scope];
  const now = Date.now();
  const key = bucketKey(scope, fingerprint);
  const bucket = BUCKETS.get(key);

  if (!bucket || now - bucket.windowStartMs >= cfg.windowMs) {
    BUCKETS.set(key, { windowStartMs: now, count: 1 });
    return;
  }

  BUCKETS.set(key, { windowStartMs: bucket.windowStartMs, count: bucket.count + 1 });
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
