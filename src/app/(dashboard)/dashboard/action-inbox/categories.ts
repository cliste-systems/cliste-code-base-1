import type { StatusVariant } from "@/components/dashboard/dashboard-surface";

/**
 * Universal Action Inbox categories (inferred from ticket summary text).
 */
export type ActionCategory =
  | "booking_request"
  | "callback"
  | "urgent"
  | "confirm"
  | "quote"
  | "lead"
  | "complaint"
  | "unclear"
  | "failed"
  | "follow_up";

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  booking_request: "Booking requested",
  callback: "Callback needed",
  urgent: "Urgent",
  confirm: "Confirm booking",
  quote: "Price enquiry",
  lead: "New enquiry",
  complaint: "Complaint",
  unclear: "Needs review",
  failed: "Missed call",
  follow_up: "Follow-up",
};

/** Compact pill label in list rows — kept identical to the full label so the
 *  list chip and the detail badge read the same. Rendered UPPERCASE as a tag. */
export const ACTION_CATEGORY_SHORT: Record<ActionCategory, string> = {
  booking_request: "Booking requested",
  callback: "Callback needed",
  urgent: "Urgent",
  confirm: "Confirm booking",
  quote: "Price enquiry",
  lead: "New enquiry",
  complaint: "Complaint",
  unclear: "Needs review",
  failed: "Missed call",
  follow_up: "Follow-up",
};

export const ACTION_CATEGORIES: readonly ActionCategory[] = [
  "booking_request",
  "callback",
  "urgent",
  "confirm",
  "quote",
  "lead",
  "complaint",
  "unclear",
  "failed",
  "follow_up",
] as const;

export type ActionCategoryFilter = "all" | ActionCategory;

export function actionCategoryFilterOptions(
  labels: Record<ActionCategory, string>,
): { value: ActionCategoryFilter; label: string }[] {
  return [
    { value: "all", label: "All types" },
    ...ACTION_CATEGORIES.map((c) => ({
      value: c as ActionCategoryFilter,
      label: labels[c],
    })),
  ];
}

export const ACTION_CATEGORY_FILTER_OPTIONS = actionCategoryFilterOptions(
  ACTION_CATEGORY_LABELS,
);

/**
 * Status pill tone per inbox category. The category is read from the text label,
 * while urgency is handled with neutral Cliste contrast rather than extra hues.
 */
export function categoryStatusVariant(category: ActionCategory): StatusVariant {
  switch (category) {
    case "urgent":
    case "complaint":
      return "attention";
    case "failed":
      return "muted";
    default:
      return "brand";
  }
}

export function classifyActionCategory(summary: string | null | undefined): ActionCategory {
  const s = String(summary ?? "").toLowerCase();
  if (!s.trim()) return "follow_up";

  if (/\b(urgent|emergency|asap|immediately|right away|critical)\b/.test(s)) {
    return "urgent";
  }
  if (
    /booking request.*callback|callback.*booking request|booking request — callback needed/i.test(
      s,
    )
  ) {
    return "booking_request";
  }
  if (/\b(complaint|unhappy|angry|refund|disappointed|upset|terrible|rude)\b/.test(s)) {
    return "complaint";
  }
  if (/(call ?back|callback|ring (me|them) back|return (the )?call|call me back|wants a call)/.test(s)) {
    return "callback";
  }
  if (/\b(quote|estimate|how much|pricing|price for|cost of)\b/.test(s)) {
    return "quote";
  }
  if (/(confirm|confirmation|verify|double.?check|reconfirm)/.test(s)) {
    return "confirm";
  }
  if (/(new customer|interested in|sales|lead|potential|enquir|inquir)/.test(s)) {
    return "lead";
  }
  if (/(hung up|no answer|dropped|disconnect|cut off|incomplete|unfinished|failed call|call failed)/.test(s)) {
    return "failed";
  }
  if (/(unclear|not sure|couldn.?t understand|unintelligible|garbled|hard to hear|didn.?t catch)/.test(s)) {
    return "unclear";
  }
  return "follow_up";
}
