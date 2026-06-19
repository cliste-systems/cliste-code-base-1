/**
 * Hard rejects for owner free-text that would override Cara safety/compliance.
 */

const COMPLIANCE_OVERRIDE_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern:
      /\b(?:don'?t|do not|never|skip|avoid|without)\b[^.]{0,40}\b(?:say|mention|tell|admit)\b[^.]{0,40}\b(?:ai|robot|assistant|artificial)/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern:
      /\b(?:don'?t|do not|never|skip|avoid)\b[^.]{0,40}\b(?:mention|say|give)\b[^.]{0,30}\brecord/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern: /\bskip\b[^.]{0,30}\bdisclosure\b/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern:
      /\b(?:say yes|just agree|always agree|guess|make up|invent)\b[^.]{0,40}\b(?:if|when)\b[^.]{0,20}\b(?:unsure|don'?t know|uncertain)/i,
    message:
      "Cara never guesses when she's unsure — she takes a message instead.",
  },
  {
    pattern:
      /\b(?:guess|just say yes|agree anyway)\b[^.]{0,30}\b(?:if|when)\b[^.]{0,20}\b(?:unsure|don'?t know)/i,
    message:
      "Cara never guesses when she's unsure — she takes a message instead.",
  },
  {
    pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b/i,
    message: "Cara can't follow instructions that override her safety rules.",
  },
  {
    pattern: /\bsystem\s*:/i,
    message: "Cara can't follow instructions that override her safety rules.",
  },
  {
    pattern: /\b(?:pretend|act)\s+(?:you\s+are|to\s+be)\s+(?:a\s+)?human\b/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
];

const PAYMENT_SECURITY_BLOCK_PATTERNS: RegExp[] = [
  /\bcard\s+details?\b/i,
  /\bcredit\s+card\b/i,
  /\bdebit\s+card\b/i,
  /\bcard\s+number\b/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bsecurity\s+code\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /\bpayment\s+(?:over|on|via)\s+(?:the\s+)?phone\b/i,
  /\btake\s+(?:their\s+)?card\b/i,
  /\bcollect\s+(?:their\s+)?card\b/i,
];

export const PROMPT_INJECTION_PAYMENT_MESSAGE =
  "Cara never collects payment or security details on a recorded call.";

export type PromptInjectionViolation = {
  message: string;
};

export function detectPromptInjectionViolation(
  text: string,
): PromptInjectionViolation | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const { pattern, message } of COMPLIANCE_OVERRIDE_PATTERNS) {
    if (pattern.test(trimmed)) return { message };
  }

  for (const pattern of PAYMENT_SECURITY_BLOCK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { message: PROMPT_INJECTION_PAYMENT_MESSAGE };
    }
  }

  return null;
}

export function isPromptInjectionSafe(text: string): boolean {
  return detectPromptInjectionViolation(text) === null;
}
