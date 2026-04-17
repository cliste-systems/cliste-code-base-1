import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

/**
 * Shared HMAC-signed cookie helper for the /admin and /dashboard password
 * gates. We used to store the env secret verbatim in the cookie, which meant
 * that any attacker who stole the cookie (misconfigured log, XSS against a
 * future surface, a leaked browser sync, a badly configured CDN cache, etc.)
 * would walk away with the actual gate password.
 *
 * With this helper the cookie body is `<expiresAtSeconds>.<hexHmac>`. Only the
 * server can mint a new one (it needs the secret) and only the server can
 * verify one. Stealing the cookie still lets the attacker in until it expires,
 * but they can't extract the underlying password — so rotating the env secret
 * is a cheap nuke option.
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function encoder(): TextEncoder {
  return new TextEncoder();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder().encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function createGateCookieValue(
  prefix: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${prefix}:${expiresAt}`;
  const sig = await sign(payload, secret);
  return `${expiresAt}.${sig}`;
}

export async function isValidGateCookieValue(
  raw: string | null | undefined,
  prefix: string,
  secret: string
): Promise<boolean> {
  const token = raw?.trim();
  if (!token) return false;
  const [expiresAtRaw, sig] = token.split(".", 2);
  if (!expiresAtRaw || !sig) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(`${prefix}:${expiresAt}`, secret);
  return timingSafeEqualUtf8(sig, expected);
}

export const DASHBOARD_GATE_COOKIE_PREFIX = "dashboard-gate";
export const ADMIN_GATE_COOKIE_PREFIX = "admin-gate";
export const DEFAULT_GATE_TTL_SECONDS = DEFAULT_TTL_SECONDS;
