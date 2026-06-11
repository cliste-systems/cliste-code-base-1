import { formatE164ForDisplay } from "@/lib/call-history-types";
import { isUnknownCallerLabel } from "@/lib/caller-identity";

import type { ActionCategory, ActionCategoryFilter } from "./categories";

const EMAIL_IN_TEXT_RE =
  /\b[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z]{2,})+\b/i;

export type ActionTicketStatus = "open" | "resolved";

export type RelatedCallPreview = {
  id: string;
  summary: string | null;
  dateLabel: string;
  callerName?: string | null;
};

export type ActionInboxItem = {
  id: string;
  callerNumber: string;
  callerDisplay: string;
  /** Best display name (ticket, client record, or call log). */
  callerName: string;
  /** @deprecated Use callerName — kept for search/copy compatibility. */
  contactLabel: string;
  /** Present only when saved on the client profile or mentioned on the ticket — often null. */
  contactEmail: string | null;
  summary: string;
  status: ActionTicketStatus;
  createdAt: string;
  createdAtLabel: string;
  category: ActionCategory;
  categoryTitle: string;
  categoryShort: string;
  relatedCall: RelatedCallPreview | null;
};

export type ActionInboxMetrics = {
  openCount: number;
  urgentCount: number;
  callbackCount: number;
  resolvedCount: number;
};

export function formatActionDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  const time = d.toLocaleString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (d >= startToday) return `Today, ${time}`;
  if (d >= startYesterday) return `Yesterday, ${time}`;

  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function extractEmailFromText(text: string | null | undefined): string | null {
  const match = String(text ?? "").match(EMAIL_IN_TEXT_RE);
  if (!match) return null;
  return normalizeContactEmail(match[0]);
}

/** Trim and validate — returns null when missing or not a real address. */
export function normalizeContactEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!EMAIL_IN_TEXT_RE.test(email)) return null;
  return email;
}

export function hasContactEmail(
  item: Pick<ActionInboxItem, "contactEmail">,
): boolean {
  return normalizeContactEmail(item.contactEmail) !== null;
}

/**
 * Email from client profile first; otherwise mentioned in ticket text.
 * Most callers will not have one — null is expected.
 */
export function resolveContactEmail(
  clientEmail: string | null | undefined,
  ticketSummary: string | null | undefined,
): string | null {
  return (
    normalizeContactEmail(clientEmail) ??
    extractEmailFromText(ticketSummary) ??
    null
  );
}

export function hasKnownCallerName(
  item: Pick<ActionInboxItem, "callerName" | "callerDisplay" | "callerNumber">,
): boolean {
  const name = item.callerName.trim();
  if (!name || isUnknownCallerLabel(name)) return false;
  const phone =
    item.callerDisplay.trim() ||
    formatE164ForDisplay(item.callerNumber.trim()) ||
    "";
  if (!phone) return true;
  if (name === phone || name === item.callerNumber.trim()) return false;
  const key = phoneDigitsKey(item.callerNumber);
  if (key.length > 0 && phoneDigitsKey(name) === key) return false;
  return true;
}

/** One-line preview for the work queue list. */
export function inboxListSummaryPreview(summary: string, maxLen = 96): string {
  const text = summary.trim();
  if (!text) return "No details captured yet.";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

function phoneDigitsKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : "";
}

/** Caller line for inbox UI — never repeats the same number twice. */
export function inboxCallerMetaLine(
  item: Pick<
    ActionInboxItem,
    "callerName" | "callerDisplay" | "callerNumber" | "createdAtLabel"
  >,
): string {
  const phone =
    item.callerDisplay.trim() ||
    formatE164ForDisplay(item.callerNumber.trim()) ||
    "Unknown";

  if (hasKnownCallerName(item)) {
    return `${phone} · ${item.createdAtLabel}`;
  }

  return item.createdAtLabel;
}

export function nextStepForCategory(category: ActionCategory): string {
  switch (category) {
    case "callback":
      return "Call the contact back";
    case "urgent":
      return "Review and respond";
    case "confirm":
      return "Confirm the request";
    case "unclear":
      return "Review the call";
    case "quote":
      return "Follow up with details";
    case "lead":
      return "Contact the caller";
    case "complaint":
      return "Review carefully";
    case "failed":
      return "Check the call and retry if needed";
    case "follow_up":
    default:
      return "Review this item";
  }
}

export function matchesActionSearch(item: ActionInboxItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, "");
  const hay = [
    item.callerName,
    item.contactLabel,
    item.contactEmail,
    item.callerDisplay,
    item.callerNumber,
    item.summary,
    item.categoryTitle,
    item.categoryShort,
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (qDigits.length >= 4 && item.callerNumber.replace(/\D/g, "").includes(qDigits)) {
    return true;
  }
  return false;
}

export function matchesCategoryFilter(
  item: ActionInboxItem,
  filter: ActionCategoryFilter,
): boolean {
  if (filter === "all") return true;
  return item.category === filter;
}

export function buildActionInboxMetrics(items: ActionInboxItem[]): ActionInboxMetrics {
  let openCount = 0;
  let urgentCount = 0;
  let callbackCount = 0;
  let resolvedCount = 0;

  for (const item of items) {
    if (item.status === "resolved") {
      resolvedCount += 1;
      continue;
    }
    openCount += 1;
    if (item.category === "urgent") urgentCount += 1;
    if (item.category === "callback") callbackCount += 1;
  }

  return { openCount, urgentCount, callbackCount, resolvedCount };
}

export function copyDetailsText(item: ActionInboxItem): string {
  const email = normalizeContactEmail(item.contactEmail);
  return [
    `Type: ${item.categoryTitle}`,
    `Status: ${item.status === "open" ? "Open" : "Resolved"}`,
    hasKnownCallerName(item) ? `Name: ${item.callerName}` : null,
    item.callerDisplay ? `Phone: ${item.callerDisplay}` : null,
    email ? `Email: ${email}` : "Email: Not on file",
    "",
    item.summary.trim() || "No additional details available.",
  ]
    .filter(Boolean)
    .join("\n");
}
