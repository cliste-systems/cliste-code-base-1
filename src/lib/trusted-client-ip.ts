/**
 * Resolve a client IP for security logging and rate limiting.
 *
 * On Vercel, prefer platform-provided forwarding headers over spoofable
 * cf-connecting-ip / x-real-ip when the Cloudflare edge secret is absent.
 */

const EDGE_HEADER = "x-cliste-edge";

export function edgeHeaderPresent(headersList: Headers): boolean {
  return Boolean(headersList.get(EDGE_HEADER)?.trim());
}

/** Best-effort client IP for audit logs and rate limits. */
export function getTrustedClientIp(headersList: Headers): string {
  const vercelForwarded = headersList.get("x-vercel-forwarded-for")?.trim();
  if (vercelForwarded) {
    const parts = vercelForwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  const xff = headersList.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  if (edgeHeaderPresent(headersList)) {
    const fromCf = headersList.get("cf-connecting-ip")?.trim();
    if (fromCf) return fromCf;
    const fromRealIp = headersList.get("x-real-ip")?.trim();
    if (fromRealIp) return fromRealIp;
  }

  return "0.0.0.0";
}

export function maskIpForLog(ip: string): string | null {
  const raw = ip.trim();
  if (!raw || raw === "0.0.0.0") return null;
  if (raw.includes(".")) {
    const p = raw.split(".");
    if (p.length === 4) return `${p[0]}.${p[1]}.x.x`;
    return null;
  }
  if (raw.includes(":")) {
    const p = raw.split(":");
    if (p.length >= 2) return `${p[0]}:${p[1]}:****`;
  }
  return null;
}
