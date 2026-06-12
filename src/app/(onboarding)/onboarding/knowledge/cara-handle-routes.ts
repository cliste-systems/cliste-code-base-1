import {
  CARA_HANDLE_OPTIONS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
} from "./train-cara-constants";

export function parseHandleOptions(raw: unknown): CaraHandleOptionId[] {
  if (!Array.isArray(raw)) return ensureRequiredHandleOptions([]);
  const valid = new Set(CARA_HANDLE_OPTIONS.map((o) => o.id));
  const parsed = raw.filter(
    (id): id is CaraHandleOptionId => typeof id === "string" && valid.has(id as CaraHandleOptionId),
  );
  return ensureRequiredHandleOptions(parsed);
}
