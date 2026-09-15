/** Sentinel stored on rows after GDPR erasure — no longer matches a real caller. */
export const ERASED_CALLER_E164 = "+000000000000";

export type CallerDataErasureAudit = {
  erasedAt: string | null;
  erasedByLabel: string | null;
  erasedReason: string | null;
};

export function isCallerDataErased(
  audit: CallerDataErasureAudit | null | undefined,
): boolean {
  return Boolean(audit?.erasedAt?.trim());
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
  const when = audit.erasedAt ? formatCallerDataErasedAt(audit.erasedAt) : "Unknown time";
  const who = audit.erasedByLabel?.trim() || "Staff member";
  const reason = audit.erasedReason?.trim() || "No reason recorded";
  return `Caller data erased on ${when} by ${who}. Reason: ${reason}`;
}
