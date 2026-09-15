import {
  classifyActionCategory,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import type { CallOutcome } from "@/lib/call-history-types";
import {
  isPostCallAttentionStatus,
  type PostCallStatus,
} from "@/lib/post-call-processing-types";

export type CallAttentionLevel = "routine" | "follow_up" | "urgent";

const URGENT_CATEGORIES = new Set<ActionCategory>(["urgent", "complaint"]);

export function isUrgentActionCategory(category: ActionCategory): boolean {
  return URGENT_CATEGORIES.has(category);
}

/** Attention stripe for open department / inbox tickets (resolved → routine). */
export function resolveTicketAttentionLevel(
  category: ActionCategory,
  status: "open" | "resolved",
): CallAttentionLevel {
  if (status === "resolved") return "routine";
  if (isUrgentActionCategory(category)) return "urgent";
  return "follow_up";
}

export type CallAttentionLegendItem = {
  level: CallAttentionLevel;
  label: string;
  description: string;
  swatchClass: string;
  rowAccentClass: string;
  selectedRowAccentClass: string;
};

export const CALL_ATTENTION_LEGEND: CallAttentionLegendItem[] = [
  {
    level: "routine",
    label: "Normal",
    description: "Handled — no follow-up needed",
    swatchClass: "bg-[#35443f]",
    rowAccentClass: "border-l-[3px] border-l-[#35443f]/35",
    selectedRowAccentClass: "border-l-4 border-l-[#35443f]/55",
  },
  {
    level: "follow_up",
    label: "Request",
    description: "Order or department request to review",
    swatchClass: "bg-amber-500",
    rowAccentClass: "border-l-[3px] border-l-amber-500",
    selectedRowAccentClass: "border-l-4 border-l-amber-500",
  },
  {
    level: "urgent",
    label: "Urgent",
    description: "Time-sensitive callback or processing issue",
    swatchClass: "bg-red-600",
    rowAccentClass: "border-l-[3px] border-l-red-600",
    selectedRowAccentClass: "border-l-4 border-l-red-600",
  },
];

export const ATTENTION_TAG_RED_CLASS =
  "border-red-200 bg-red-50 text-red-800";
export const ATTENTION_TAG_AMBER_CLASS =
  "border-amber-200 bg-amber-50 text-amber-900";

export type AttentionTag = {
  label: string;
  tagClassName: string;
};

const AMBER_ATTENTION_TAG_LABELS: Partial<Record<ActionCategory, string>> = {
  order: "Order",
  booking_request: "Booking",
  callback: "Callback",
  quote: "Quote",
  lead: "Enquiry",
  confirm: "Confirm",
  unclear: "Review",
  follow_up: "Request",
};

function amberAttentionTagLabel(category: ActionCategory | null | undefined): string {
  if (!category) return "Request";
  return AMBER_ATTENTION_TAG_LABELS[category] ?? "Request";
}

/** List/detail chip — complaint and urgent both use red; orders/requests use amber. */
export function resolveAttentionTag(input: {
  level: CallAttentionLevel;
  category?: ActionCategory | null;
}): AttentionTag | null {
  if (input.level === "routine") return null;

  if (input.category === "complaint") {
    return { label: "Complaint", tagClassName: ATTENTION_TAG_RED_CLASS };
  }
  if (input.category === "urgent" || input.level === "urgent") {
    return { label: "Urgent", tagClassName: ATTENTION_TAG_RED_CLASS };
  }
  return {
    label: amberAttentionTagLabel(input.category),
    tagClassName: ATTENTION_TAG_AMBER_CLASS,
  };
}

export function attentionRowAccent(
  level: CallAttentionLevel,
  category?: ActionCategory | null,
): CallAttentionLegendItem {
  const tag = resolveAttentionTag({ level, category });
  if (tag?.tagClassName === ATTENTION_TAG_AMBER_CLASS) {
    return callAttentionLegendItem("follow_up");
  }
  if (tag) {
    return callAttentionLegendItem("urgent");
  }
  return callAttentionLegendItem(level);
}

const ATTENTION_BY_LEVEL = new Map(
  CALL_ATTENTION_LEGEND.map((item) => [item.level, item]),
);

export function callAttentionLegendItem(
  level: CallAttentionLevel,
): CallAttentionLegendItem {
  return ATTENTION_BY_LEVEL.get(level)!;
}

export function resolveCallAttentionLevel(input: {
  hasOpenAction: boolean;
  postCallStatus: PostCallStatus;
  aiSummary?: string | null;
  followUpSummary?: string | null;
  outcome: CallOutcome;
}): CallAttentionLevel {
  if (isPostCallAttentionStatus(input.postCallStatus)) {
    return "urgent";
  }

  const summary =
    input.followUpSummary?.trim() ||
    input.aiSummary?.trim() ||
    "";

  if (input.hasOpenAction) {
    if (summary && URGENT_CATEGORIES.has(classifyActionCategory(summary))) {
      return "urgent";
    }
    return "follow_up";
  }

  if (
    input.outcome === "callback_requested" ||
    input.outcome === "action_created"
  ) {
    if (summary && URGENT_CATEGORIES.has(classifyActionCategory(summary))) {
      return "urgent";
    }
    if (input.outcome === "callback_requested") {
      return "follow_up";
    }
  }

  return "routine";
}
