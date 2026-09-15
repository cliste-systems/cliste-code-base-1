/** Sentinel stored on rows after GDPR erasure — no longer matches a real caller. */
export const ERASED_CALLER_E164 = "+000000000000";

export const CALLER_DATA_ERASED_BADGE_CLASS =
  "border-blue-200 bg-blue-50 text-blue-800";

export const CALLER_DATA_ERASED_ROW_ACCENT = {
  rowAccentClass: "border-l-[3px] border-l-blue-500",
  selectedRowAccentClass: "border-l-4 border-l-blue-500",
} as const;

export const CALLER_DATA_ERASED_LABEL = "Caller data erased";

export function isErasedCallerNumber(phone: string | null | undefined): boolean {
  return phone?.trim() === ERASED_CALLER_E164;
}

export type CallerDataErasureAudit = {
  erasedAt?: string | null;
  erasedByLabel?: string | null;
  erasedReason?: string | null;
  callerDataErasedAt?: string | null;
  callerDataErasedByLabel?: string | null;
  callerDataErasedReason?: string | null;
};

export function pickCallerDataErasureAudit(
  source: CallerDataErasureAudit | null | undefined,
): Required<Pick<CallerDataErasureAudit, "erasedAt" | "erasedByLabel" | "erasedReason">> {
  return {
    erasedAt: source?.erasedAt ?? source?.callerDataErasedAt ?? null,
    erasedByLabel: source?.erasedByLabel ?? source?.callerDataErasedByLabel ?? null,
    erasedReason: source?.erasedReason ?? source?.callerDataErasedReason ?? null,
  };
}

export function isCallerDataErased(
  audit: CallerDataErasureAudit | null | undefined,
): boolean {
  const { erasedAt } = pickCallerDataErasureAudit(audit);
  return Boolean(erasedAt?.trim());
}

export function formatCallerDataErasedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function callerDataErasureSummary(audit: CallerDataErasureAudit): string {
  const { erasedAt, erasedByLabel, erasedReason } = pickCallerDataErasureAudit(audit);
  const when = erasedAt ? formatCallerDataErasedAt(erasedAt) : "Unknown time";
  const who = erasedByLabel?.trim() || "Staff member";
  const reason = erasedReason?.trim() || "No reason recorded";
  return `Caller data erased on ${when} by ${who}. Reason: ${reason}`;
}
