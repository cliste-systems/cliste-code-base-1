import type { StatusVariant } from "@/components/dashboard/dashboard-surface";

/**
 * Universal Action Inbox categories (inferred from ticket summary text).
 */
export type ActionCategory =
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
  callback: "Callback requested",
  urgent: "Urgent issue",
  confirm: "Needs confirmation",
  quote: "Quote request",
  lead: "Sales enquiry",
  complaint: "Complaint",
  unclear: "Unclear request",
  failed: "Failed call",
  follow_up: "Follow-up needed",
};

/** Compact pill label in list rows. */
export const ACTION_CATEGORY_SHORT: Record<ActionCategory, string> = {
  callback: "Callback",
  urgent: "Urgent",
  confirm: "Confirm",
  quote: "Quote",
  lead: "Sales",
  complaint: "Complaint",
  unclear: "Unclear",
  failed: "Failed",
  follow_up: "Follow-up",
};

export const ACTION_CATEGORIES: readonly ActionCategory[] = [
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

export const ACTION_CATEGORY_FILTER_OPTIONS: {
  value: ActionCategoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All types" },
  ...ACTION_CATEGORIES.map((c) => ({
    value: c as ActionCategoryFilter,
    label: ACTION_CATEGORY_LABELS[c],
  })),
];

/** Status pill colour per inbox category (meaning-only). */
export function categoryStatusVariant(category: ActionCategory): StatusVariant {
  switch (category) {
    case "urgent":
    case "complaint":
      return "attention";
    case "callback":
      return "info";
    case "failed":
      return "muted";
    case "confirm":
    case "quote":
    case "lead":
      return "info";
    case "follow_up":
    case "unclear":
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
