const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8-char code for SMS and phone self-service (no I, O, 0, 1). */
export function generateBookingReference(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)]!;
  }
  return s;
}

export function normalizeCustomerPhoneE164(phone: string): string {
  const t = phone.trim();
  if (t.startsWith("+")) {
    return t;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    return `+353${digits.slice(1)}`;
  }
  if (digits.startsWith("353") && digits.length >= 11) {
    return `+${digits}`;
  }
  return t;
}

/**
 * After {@link normalizeCustomerPhoneE164}, rejects incomplete numbers (e.g. "+353" only).
 * E.164 allows up to 15 digits total including country code.
 */
export function isPlausibleCustomerPhoneE164(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
