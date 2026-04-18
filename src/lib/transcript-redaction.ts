/**
 * Server-side defense-in-depth redaction for voice transcripts.
 *
 * The agent prompt already tells the LLM not to read back card numbers,
 * PPS numbers, IBANs, dates of birth etc. But callers can volunteer
 * those (and the STT will dutifully transcribe them), and we can't
 * trust the agent's self-discipline to keep them out of `transcript`,
 * `transcript_review` or `ai_summary`.
 *
 * This module removes patterns that almost certainly should not be
 * stored. It is intentionally conservative — false positives mean the
 * salon sees `[REDACTED-CARD]` instead of digits, which is fine.
 */

const PATTERNS: { name: string; re: RegExp; replace: string }[] = [
  // ------- Payment card numbers (PAN). 13-19 digits with spaces/dashes.
  // Run a Luhn check to cut down on false positives like phone numbers.
  // Implemented separately below because regex alone can't do Luhn.
  // ------- IBAN (Ireland: IE + 2 check digits + 4 BIC + 14 alphanum).
  // We accept any reasonable IBAN format up to 34 chars.
  {
    name: "IBAN",
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi,
    replace: "[REDACTED-IBAN]",
  },
  // ------- Irish PPS number: 7 digits + 1-2 letters. e.g. 1234567T or 1234567TA
  {
    name: "PPSN",
    re: /\b\d{7}[A-W]{1,2}\b/g,
    replace: "[REDACTED-PPSN]",
  },
  // ------- CVV / CVC said over the phone — "CVV is 123" / "security code 1234"
  {
    name: "CVV",
    re: /\b(?:CVV|CVC|security\s*code)[^\d]{0,8}\d{3,4}\b/gi,
    replace: "[REDACTED-CVV]",
  },
  // ------- Dates of birth (rough): 4-digit year forms. We avoid removing
  // arbitrary dates ("on the 12th of June at 3 pm") — only DOB-shaped.
  {
    name: "DOB",
    re: /\b(?:DOB|date\s+of\s+birth|born\s+on)[:\s]{0,10}[\d./-]{6,12}\b/gi,
    replace: "[REDACTED-DOB]",
  },
];

/**
 * Find candidate PANs (13-19 digit runs allowing spaces/dashes) and
 * replace those that pass a Luhn checksum. Phone numbers, booking
 * references and ID numbers usually fail Luhn so they survive.
 */
function redactPans(input: string): string {
  return input.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (luhnValid(digits)) return "[REDACTED-CARD]";
    return match;
  });
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Redact a free-text field. Returns the cleaned string and the list of
 * pattern names that fired (so the caller can audit-log if anything was
 * redacted).
 */
export function redactCallText(input: string | null | undefined): {
  text: string | null;
  hits: string[];
} {
  if (input == null) return { text: null, hits: [] };
  const original = String(input);
  if (!original.trim()) return { text: original, hits: [] };

  const hits: string[] = [];
  let text = original;

  const beforePan = text;
  text = redactPans(text);
  if (text !== beforePan) hits.push("PAN");

  for (const p of PATTERNS) {
    const before = text;
    text = text.replace(p.re, p.replace);
    if (text !== before) hits.push(p.name);
  }

  return { text, hits };
}
