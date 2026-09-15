import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";

/** Digit variants for matching local, national, and E.164 phone formats. */
export function callerPhoneSearchKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return [];

  const keys = new Set<string>([digits]);

  const e164 = normalizeCustomerPhoneE164(trimmed);
  const e164Digits = e164.replace(/\D/g, "");
  if (e164Digits.length >= 4) {
    keys.add(e164Digits);
  }

  if (digits.startsWith("353") && digits.length >= 11) {
    keys.add(digits.slice(3));
    keys.add(`0${digits.slice(3)}`);
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    keys.add(digits.slice(1));
    keys.add(`353${digits.slice(1)}`);
  }

  return [...keys];
}

export function phoneQueryMatchesCaller(query: string, ...numbers: string[]): boolean {
  const queryKeys = callerPhoneSearchKeys(query);
  if (queryKeys.length === 0) return false;

  const callerKeys = new Set<string>();
  for (const number of numbers) {
    for (const key of callerPhoneSearchKeys(number)) {
      callerKeys.add(key);
    }
  }

  for (const queryKey of queryKeys) {
    for (const callerKey of callerKeys) {
      if (callerKey.includes(queryKey) || queryKey.includes(callerKey)) {
        return true;
      }
    }
  }

  return false;
}
