import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

/** Set when admin uses "Open dashboard"; sidebar shows "dev" instead of the salon user's name. */
export const SUPPORT_DASHBOARD_COOKIE = "cliste_support_dashboard";
const SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS = 60 * 60 * 8;
const SUPPORT_DASHBOARD_COOKIE_PREFIX = "support-dashboard";

function getSupportDashboardSigningSecret(): string | null {
  return (
    process.env.CLISTE_SUPPORT_DASHBOARD_SECRET?.trim() ||
    process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim() ||
    null
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signSupportPayload(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function createSupportDashboardCookieValue(): Promise<string | null> {
  const secret = getSupportDashboardSigningSecret();
  if (!secret) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS;
  const payload = `${SUPPORT_DASHBOARD_COOKIE_PREFIX}:${expiresAt}`;
  const sig = await signSupportPayload(payload, secret);
  return `${expiresAt}.${sig}`;
}

export async function isValidSupportDashboardCookieValue(
  raw: string | null | undefined
): Promise<boolean> {
  const token = raw?.trim();
  if (!token) return false;
  const secret = getSupportDashboardSigningSecret();
  if (!secret) return false;
  const [expiresAtRaw, sig] = token.split(".", 2);
  if (!expiresAtRaw || !sig) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${SUPPORT_DASHBOARD_COOKIE_PREFIX}:${expiresAt}`;
  const expected = await signSupportPayload(payload, secret);
  return timingSafeEqualUtf8(sig, expected);
}

export function supportDashboardCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS,
  };
}
