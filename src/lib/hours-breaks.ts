import {
  dedupeCaraSetupChips,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import { HOURS_NOTE_MAX_LENGTH } from "@/lib/general-boundary";

/** Stored in `business_hours._hoursNote` — readable when Cara speaks breaks aloud. */
export const HOURS_BREAKS_JOINER = " · ";

export const HOURS_BREAKS_MAX_ITEMS = 6;

export function parseHoursBreaks(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.includes(HOURS_BREAKS_JOINER)) {
    return dedupeCaraSetupChips(trimmed.split(HOURS_BREAKS_JOINER));
  }
  return dedupeCaraSetupChips([trimmed]);
}

export function serializeHoursBreaks(items: readonly string[]): string {
  return dedupeCaraSetupChips([...items])
    .join(HOURS_BREAKS_JOINER)
    .slice(0, HOURS_NOTE_MAX_LENGTH);
}

export function canAddHoursBreak(
  items: readonly string[],
  candidate: string,
): { ok: true } | { ok: false; message: string } {
  const normalized = normalizeCaraSetupChip(candidate);
  if (!normalized) return { ok: false, message: "Enter a break or exception first." };
  if (items.length >= HOURS_BREAKS_MAX_ITEMS) {
    return {
      ok: false,
      message: `You can add up to ${HOURS_BREAKS_MAX_ITEMS} breaks or exceptions.`,
    };
  }
  const next = serializeHoursBreaks([...items, normalized]);
  if (!next.trim()) {
    return { ok: false, message: "That break is too long." };
  }
  if (next.length >= HOURS_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: "Breaks & exceptions are full — remove one or shorten the text.",
    };
  }
  return { ok: true };
}
