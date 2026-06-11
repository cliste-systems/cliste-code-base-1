/** Limits and sanitisation for editable voice greeting lines. */

export const MAX_GREETING_LINE_LENGTH = 200;
export const MAX_GREETING_SCRIPT_LENGTH = 500;

const CONTROL_AND_BIDI =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

/** Strip control chars, bidi overrides, and collapse whitespace for storage/TTS. */
export function sanitizeGreetingLine(raw: string): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(CONTROL_AND_BIDI, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function greetingLineHasInvalidFormat(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_GREETING_LINE_LENGTH) return true;
  if (/[\r\n]/.test(trimmed)) return true;
  return false;
}

export function greetingScriptTooLong(script: string): boolean {
  return script.trim().length > MAX_GREETING_SCRIPT_LENGTH;
}

/** Delimit untrusted user text in LLM prompts — mitigates prompt injection. */
export function wrapUserContentForPrompt(label: string, content: string): string {
  const safe = String(content ?? "")
    .replace(/<<</g, "")
    .replace(/>>>/g, "");
  return `<<<${label}_START>>>\n${safe}\n<<<${label}_END>>>`;
}

export function validateAiGreetingSuggestionLine(
  line: string | null | undefined,
): string | undefined {
  const sanitized = sanitizeGreetingLine(String(line ?? ""));
  if (!sanitized || greetingLineHasInvalidFormat(sanitized)) {
    return undefined;
  }
  return sanitized;
}

export type SanitizedVoiceGreetingPayload =
  | { ok: true; greetingIntro: string; greetingClosing: string }
  | { ok: false; message: string };

export function sanitizeVoiceGreetingPayload(input: {
  greetingIntro: string;
  greetingClosing: string;
  defaultClosing: string;
}): SanitizedVoiceGreetingPayload {
  const greetingIntro = sanitizeGreetingLine(input.greetingIntro);
  const greetingClosing =
    sanitizeGreetingLine(input.greetingClosing) || input.defaultClosing;

  if (!greetingIntro) {
    return { ok: false, message: "Add an opening line." };
  }
  if (greetingLineHasInvalidFormat(greetingIntro)) {
    return { ok: false, message: "Opening line is too long or invalid." };
  }
  if (greetingLineHasInvalidFormat(greetingClosing)) {
    return { ok: false, message: "Closing line is too long or invalid." };
  }

  return { ok: true, greetingIntro, greetingClosing };
}
