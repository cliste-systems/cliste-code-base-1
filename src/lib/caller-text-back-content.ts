import { isUnknownCallerLabel } from "@/lib/caller-identity";
import { formatPhoneForDisplay } from "@/lib/phone-display";

export type ComposeCallerTextBackInput = {
  callerName: string;
  businessName: string;
  middle: string;
  /** Published store line customers ring (E.164). */
  storePhoneE164?: string;
};

/** First name for a friendly SMS greeting — falls back to "there". */
export function callerTextBackFirstName(callerName: string): string {
  const trimmed = callerName.trim();
  if (!trimmed || isUnknownCallerLabel(trimmed)) return "there";
  return trimmed.split(/\s+/)[0]?.trim() || "there";
}

export function buildCallerTextBackDisclaimer(): string {
  return "Do not reply to this text.";
}

export function buildCallerTextBackIntro(
  callerName: string,
  businessName: string,
): string {
  const store = businessName.trim() || "us";
  return `Hi ${callerTextBackFirstName(callerName)}, thanks for contacting ${store} earlier.`;
}

/** Friendly local format for Irish store lines in customer texts. */
export function formatStorePhoneForTextBack(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("353") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    if (local.length === 10) {
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
  }
  return formatPhoneForDisplay(e164.trim()) || e164.trim();
}

export function buildCallerTextBackCallFooter(storePhoneE164: string): string | null {
  const phone = storePhoneE164.trim();
  if (!phone) return null;
  return `If you have any other questions, give Cara a call on ${formatStorePhoneForTextBack(phone)}.`;
}

export function composeCallerTextBackMessage(
  input: ComposeCallerTextBackInput,
): string {
  const middle = input.middle.trim();
  const parts = [
    buildCallerTextBackDisclaimer(),
    buildCallerTextBackIntro(input.callerName, input.businessName),
    middle,
    buildCallerTextBackCallFooter(input.storePhoneE164 ?? ""),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildCallerTextBackSmsHref(
  phoneE164: string,
  message: string,
): string {
  const digits = phoneE164.replace(/[^\d+]/g, "");
  if (!digits) return "";
  const body = encodeURIComponent(message.trim());
  return body ? `sms:${digits}?body=${body}` : `sms:${digits}`;
}
