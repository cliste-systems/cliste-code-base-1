/**
 * SMS destination allowlist — toll-fraud / international-spam guard.
 *
 * The voice worker authenticates with a shared secret and is quota-capped, but
 * the `to` number it passes is otherwise unconstrained. To limit the blast
 * radius if that secret ever leaks (premium-rate / international toll fraud),
 * outbound caller SMS is restricted to a set of allowed E.164 dial prefixes.
 *
 * Defaults cover the product's realistic footprint (Ireland, UK, US/Canada).
 * Widen via `VOICE_SMS_ALLOWED_DIAL_PREFIXES` (comma/space separated, e.g.
 * "+353,+44,+1,+61"), or disable entirely with `VOICE_SMS_ALLOW_ALL_COUNTRIES=1`.
 */

const DEFAULT_ALLOWED_PREFIXES = ["+353", "+44", "+1"] as const;

export function allowedSmsDialPrefixes(): string[] {
  const raw = process.env.VOICE_SMS_ALLOWED_DIAL_PREFIXES?.trim();
  if (!raw) return [...DEFAULT_ALLOWED_PREFIXES];
  const list = raw
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter((p) => /^\+\d{1,4}$/.test(p));
  return list.length > 0 ? list : [...DEFAULT_ALLOWED_PREFIXES];
}

/**
 * True when `e164` is an E.164 number whose dial prefix is allowed.
 * A non-E.164 (no leading "+") destination is rejected so it cannot bypass
 * the prefix check. Set VOICE_SMS_ALLOW_ALL_COUNTRIES=1 to allow everything.
 */
export function smsDestinationAllowed(e164: string): boolean {
  if (process.env.VOICE_SMS_ALLOW_ALL_COUNTRIES === "1") return true;
  const to = e164.trim();
  if (!/^\+\d{6,15}$/.test(to)) return false;
  return allowedSmsDialPrefixes().some((prefix) => to.startsWith(prefix));
}
