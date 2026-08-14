import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

/** Set when admin uses "Open dashboard"; shows an impersonation banner in the tenant shell. */
export const SUPPORT_DASHBOARD_COOKIE = "cliste_support_dashboard";
const SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS = 60 * 60;
const SUPPORT_DASHBOARD_COOKIE_PREFIX = "support-dashboard";

function getSupportDashboardSigningSecret(): string | null {
  return process.env.CLISTE_SUPPORT_DASHBOARD_SECRET?.trim() || null;
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

export async function createSupportDashboardCookieValue(): Promise<string> {
  const secret = getSupportDashboardSigningSecret();
  if (!secret) {
    throw new Error(
      "CLISTE_SUPPORT_DASHBOARD_SECRET is not configured — refusing to mint support impersonation links.",
    );
  }
  const expiresAt = Math.floor(Date.now() / 1000) + SUPPORT_DASHBOARD_COOKIE_TTL_SECONDS;
  const payload = `${SUPPORT_DASHBOARD_COOKIE_PREFIX}:${expiresAt}`;
  const sig = await signSupportPayload(payload, secret);
  return `${expiresAt}.${sig}`;
}

export async function isValidSupportDashboardCookie(
  cookieValue: string | null | undefined,
): Promise<boolean> {
  const secret = getSupportDashboardSigningSecret();
  if (!secret || !cookieValue?.trim()) return false;
  const [expiresRaw, sig] = cookieValue.trim().split(".", 2);
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || !sig) return false;
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
