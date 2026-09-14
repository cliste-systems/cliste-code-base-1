import { formatE164ForDisplay } from "@/lib/call-history-types";
import { isUnknownCallerLabel } from "@/lib/caller-identity";
import { stripDemoRehearsalMarker } from "@/lib/dashboard-mock-cleanup";
import {
  departmentRequestTypeLabel,
  formatDepartmentListPreview,
  parseDepartmentRequestSummary,
  parseStructuredCaptureSummary,
  type StructuredCaptureField,
  type StructuredCaptureSummary,
} from "@/lib/department-request-summary";
import { retailDepartmentLabel, stripRouteSuffixFromSummary } from "@/lib/retail-department-pack";
import type { RetailDepartmentSlug } from "@/lib/retail-department-pack";

import type { ActionCategory, ActionCategoryFilter } from "./categories";

const EMAIL_IN_TEXT_RE =
  /\b[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z]{2,})+\b/i;

export type ActionTicketStatus = "open" | "resolved";

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
  /** One-line triage preview when stored on the ticket. */
  briefSummary?: string;
  status: ActionTicketStatus;
  createdAt: string;
  createdAtLabel: string;
  category: ActionCategory;
  categoryTitle: string;
  categoryShort: string;
  departmentSlug: RetailDepartmentSlug;
  departmentLabel: string;
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

/** Customer-facing ticket text — strips internal routing tags like [route: retail-stock]. */
export function displayActionTicketSummary(
  summary: string | null | undefined,
  maxLen?: number,
): string {
  const text = stripDemoRehearsalMarker(
    stripRouteSuffixFromSummary(String(summary ?? "")),
  );
  if (!text) return "No details captured yet.";
  if (typeof maxLen === "number" && text.length > maxLen) {
    return `${text.slice(0, maxLen).trimEnd()}…`;
  }
  return text;
}

/** One-line preview for the work queue list. */
export function inboxListSummaryPreview(summary: string, maxLen = 96): string {
  return displayActionTicketSummary(summary, maxLen);
}

/** Brief triage line — request type for list rows (Action Inbox + departments). */
export function briefLine(
  item: Pick<ActionInboxItem, "briefSummary" | "summary">,
  maxLen = 120,
): string {
  return departmentListPreview(item, maxLen);
}

export function departmentLabel(slug: string | null | undefined): string {
  return retailDepartmentLabel(slug);
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

export type {
  StructuredCaptureField,
  StructuredCaptureSummary,
} from "@/lib/department-request-summary";
export {
  parseDepartmentRequestSummary,
  parseStructuredCaptureSummary,
} from "@/lib/department-request-summary";

export function nextStepForCategory(category: ActionCategory): string {
  switch (category) {
    case "booking_request":
      return "Call back to arrange the booking — nothing is confirmed yet";
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
    item.departmentLabel,
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (qDigits.length >= 4 && item.callerNumber.replace(/\D/g, "").includes(qDigits)) {
    return true;
  }
  return false;
}

export function departmentRequestLine(
  item: Pick<ActionInboxItem, "briefSummary" | "summary">,
): string {
  return departmentListPreview(item);
}

/** Short list preview for department inbox — not the full ticket text shown in detail. */
export function departmentListPreview(
  item: Pick<ActionInboxItem, "briefSummary" | "summary">,
  maxLen = 120,
): string {
  const parsed = parseDepartmentRequestSummary(item.summary);
  if (parsed) {
    return formatDepartmentListPreview(parsed, maxLen);
  }

  const firstLine =
    item.summary.split(/\n/)[0]?.trim() ||
    item.briefSummary?.trim().split(/\n/)[0]?.trim() ||
    "";
  if (firstLine) {
    return clipDepartmentPreview(departmentRequestTypeLabel(firstLine), maxLen);
  }

  return "Request";
}

function clipDepartmentPreview(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "Follow-up needed";
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const clipped =
    lastSpace > Math.floor(maxLen * 0.55)
      ? slice.slice(0, lastSpace)
      : slice.trimEnd();
  return `${clipped.trimEnd()}…`;
}

export function matchesCategoryFilter(
  item: ActionInboxItem,
  filter: ActionCategoryFilter,
): boolean {
  if (filter === "all") return true;
  return item.category === filter;
}

/**
 * Work-queue priority: act-now items first, then revenue (bookings/callbacks),
 * then the rest. Drives the open-queue order so the important work surfaces
 * regardless of when it came in. Lower number = higher up.
 */
const ACTION_CATEGORY_PRIORITY: Record<ActionCategory, number> = {
  urgent: 0,
  complaint: 1,
  booking_request: 2,
  callback: 3,
  confirm: 4,
  quote: 5,
  lead: 6,
  follow_up: 7,
  unclear: 8,
  failed: 9,
};

/**
 * Sort the inbox: open items by priority then newest-first; resolved items by
 * recency only (they're not a work queue). Open/resolved live in separate tabs,
 * so cross-status order doesn't matter.
 */
export function sortActionInboxItems(items: ActionInboxItem[]): ActionInboxItem[] {
  return [...items].sort((a, b) => {
    const pa = a.status === "resolved" ? 99 : (ACTION_CATEGORY_PRIORITY[a.category] ?? 50);
    const pb = b.status === "resolved" ? 99 : (ACTION_CATEGORY_PRIORITY[b.category] ?? 50);
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
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
    displayActionTicketSummary(item.summary) || "No additional details available.",
  ]
    .filter(Boolean)
    .join("\n");
}
