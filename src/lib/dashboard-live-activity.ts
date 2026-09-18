import {
  classifyActionCategory,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import {
  departmentRequestTypeLabel,
  parseStructuredCaptureSummary,
} from "@/lib/department-request-summary";

const ACTIVITY_FEED_CATEGORY_BADGE: Record<ActionCategory, string> = {
  booking_request: "Booking",
  callback: "Callback",
  urgent: "Urgent",
  confirm: "Confirm",
  quote: "Enquiry",
  lead: "Enquiry",
  complaint: "Complaint",
  order: "Order",
  unclear: "Review",
  failed: "Missed",
  follow_up: "Enquiry",
};

function activityCategoryBadge(category: ActionCategory): string {
  return ACTIVITY_FEED_CATEGORY_BADGE[category];
}

function requestTypeFromSummary(summary: string | null | undefined): string | null {
  const text = String(summary ?? "").trim();
  if (!text) return null;

  const structured = parseStructuredCaptureSummary(text);
  if (structured) {
    return departmentRequestTypeLabel(structured.header);
  }

  return activityCategoryBadge(classifyActionCategory(text));
}

function outcomeFallbackBadge(outcome: string | null | undefined): string {
  switch (normalizeCallOutcome(String(outcome ?? ""))) {
    case "callback_requested":
      return "Callback";
    case "link_sent":
      return "Link sent";
    case "failed":
      return "Missed";
    case "voicemail_or_no_speech":
      return "Voicemail";
    case "spam_or_abuse":
      return "Spam";
    case "action_created":
      return "Enquiry";
    case "answered":
    default:
      return "Call";
  }
}

/** Caller request type for Activity page badges — order, enquiry, complaint, etc. */
export function formatActivityFeedBadge(input: {
  summary?: string | null;
  outcome?: string | null;
}): string {
  return requestTypeFromSummary(input.summary) ?? outcomeFallbackBadge(input.outcome);
}

/** @deprecated Use formatActivityFeedBadge — kept for callers that only pass outcome. */
export function formatLiveActivityCallAction(
  outcome: string | null | undefined,
  aiSummary: string | null | undefined,
): string {
  return formatActivityFeedBadge({ summary: aiSummary, outcome });
}

/** @deprecated Use formatActivityFeedBadge with ticket summary. */
export function formatLiveActivityTicketAction(
  summary?: string | null,
): string {
  return formatActivityFeedBadge({ summary });
}
