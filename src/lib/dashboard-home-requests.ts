import {
  ACTION_CATEGORY_LABELS,
  classifyActionCategory,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import {
  isCallNeedingHomeAttention,
  type HomeAttentionCallRow,
  type HomeAttentionTicketRow,
} from "@/lib/dashboard-home-attention";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** Max characters for home panel list subtitles (Needs attention, Cara training). */
export const HOME_PANEL_LIST_DESCRIPTION_MAX = 48;

export function truncateHomePanelDescription(
  text: string | null | undefined,
  max = HOME_PANEL_LIST_DESCRIPTION_MAX,
): string {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export type HomeRequestTicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
  status: string | null;
  caller_name?: string | null;
  caller_number?: string | null;
};

export type HomeRequestRow = {
  id: string;
  href: string;
  title: string;
  description: string;
  time: string;
};

export type HomeTodaysRequestStats = {
  totalToday: number;
  followUpsDue: number;
  awaitingResponse: number;
};

export type HomeAttentionCategoryCounts = {
  pricingQuestions: number;
  callbackRequests: number;
  generalEnquiries: number;
};

const FOLLOW_UP_CATEGORIES: readonly ActionCategory[] = [
  "callback",
  "follow_up",
];

function homeRequestTitle(category: ActionCategory): string {
  switch (category) {
    case "booking_request":
      return "Booking request";
    case "quote":
      return "Pricing question";
    case "callback":
      return "Callback request";
    case "lead":
      return "Product enquiry";
    case "follow_up":
      return "Follow-up needed";
    case "confirm":
      return "Confirmation needed";
    case "urgent":
      return "Urgent request";
    case "complaint":
      return "Complaint";
    case "unclear":
      return "General enquiry";
    case "failed":
      return "Failed call follow-up";
    default:
      return ACTION_CATEGORY_LABELS[category];
  }
}

function summaryPreview(summary: string | null | undefined): string {
  const trimmed = String(summary ?? "").replace(/\s+/g, " ").trim();
  return trimmed || "Request captured";
}

export function buildHomeTodaysRequestRows(input: {
  tickets: HomeRequestTicketRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;

  return [...input.tickets]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((ticket) => {
      const category = classifyActionCategory(ticket.summary);
      return {
        id: ticket.id,
        href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(ticket.id)}`,
        title: ticketCallerLabel(ticket),
        description: homeRequestTitle(category),
        time: input.formatTime(ticket.created_at),
      };
    });
}

export function buildHomeTodaysRequestStats(input: {
  tickets: HomeRequestTicketRow[];
  callbackCallsToday: number;
}): HomeTodaysRequestStats {
  const openToday = input.tickets.filter(
    (ticket) => (ticket.status ?? "open") === "open",
  );

  const followUpsDue =
    input.tickets.filter((ticket) => {
      const category = classifyActionCategory(ticket.summary);
      return FOLLOW_UP_CATEGORIES.includes(category);
    }).length + input.callbackCallsToday;

  return {
    totalToday: input.tickets.length,
    followUpsDue,
    awaitingResponse: openToday.length,
  };
}

export function buildHomeAttentionCategoryCounts(input: {
  openTickets: HomeAttentionTicketRow[];
  calls: HomeAttentionCallRow[];
}): HomeAttentionCategoryCounts {
  let pricingQuestions = 0;
  let callbackRequests = 0;
  let generalEnquiries = 0;

  for (const ticket of input.openTickets) {
    const category = classifyActionCategory(ticket.summary);
    if (category === "quote") pricingQuestions += 1;
    else if (category === "callback") callbackRequests += 1;
    else generalEnquiries += 1;
  }

  for (const call of input.calls) {
    const outcome = normalizeCallOutcome(String(call.outcome ?? ""));
    if (outcome === "callback_requested") callbackRequests += 1;
    else if (isCallNeedingHomeAttention(call.outcome)) generalEnquiries += 1;
  }

  return {
    pricingQuestions,
    callbackRequests,
    generalEnquiries,
  };
}

export type HomeCaraTrainingItemRow = {
  id: string;
  gap_summary: string | null;
  status: string | null;
  updated_at: string;
};

export type HomeCaraTrainingRow = {
  id: string;
  href: string;
  title: string;
  description: string;
  time: string;
};

function caraTrainingRowTitle(status: string | null | undefined): string {
  if (status === "draft_ready") return "Review draft";
  return "Knowledge gap";
}

export function buildHomeCaraTrainingRows(input: {
  items: HomeCaraTrainingItemRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeCaraTrainingRow[] {
  const limit = input.limit ?? 5;

  return [...input.items]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, limit)
    .map((item) => {
      const summary = summaryPreview(item.gap_summary);
      return {
        id: item.id,
        href: `${DASHBOARD_ROUTES.caraTraining}?item=${encodeURIComponent(item.id)}`,
        title: caraTrainingRowTitle(item.status),
        description: truncateHomePanelDescription(summary),
        time: input.formatTime(item.updated_at),
      };
    });
}
