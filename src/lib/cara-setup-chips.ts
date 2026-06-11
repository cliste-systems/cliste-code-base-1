/**
 * Shared chip-list helpers for Cara Setup (Services, Call handling, etc.).
 */

export const CARA_SETUP_CHIP_MAX_LENGTH = 80;

export function normalizeCaraSetupChip(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, " ");
}

export function caraSetupChipKey(raw: string): string {
  return normalizeCaraSetupChip(raw).toLowerCase();
}

export function dedupeCaraSetupChips(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = normalizeCaraSetupChip(item);
    if (!normalized) continue;
    const key = caraSetupChipKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function findExactChipInList(
  item: string,
  list: string[],
): string | undefined {
  const key = caraSetupChipKey(item);
  return list.find((existing) => caraSetupChipKey(existing) === key);
}

export function findNearDuplicateChip(
  item: string,
  list: string[],
): string | null {
  const norm = caraSetupChipKey(item);
  if (!norm) return null;

  for (const existing of list) {
    const exNorm = caraSetupChipKey(existing);
    if (!exNorm || exNorm === norm) continue;

    if (norm === `${exNorm}s` || `${norm}s` === exNorm) return existing;

    const shorter = norm.length <= exNorm.length ? norm : exNorm;
    const longer = norm.length > exNorm.length ? norm : exNorm;
    if (shorter.length >= 5 && longer.includes(shorter)) return existing;
  }

  return null;
}

export function splitCaraSetupChipInput(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => normalizeCaraSetupChip(part))
    .filter(Boolean);
}

export function isCaraSetupChipTooLong(item: string): boolean {
  return normalizeCaraSetupChip(item).length > CARA_SETUP_CHIP_MAX_LENGTH;
}
