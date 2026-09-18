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
import { isPostCallAttentionStatus } from "@/lib/post-call-processing-types";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  departmentTicketHref,
  resolveTicketDepartmentSlug,
} from "@/app/(dashboard)/dashboard/departments/department-helpers";
import { departmentListPreview } from "@/app/(dashboard)/dashboard/action-inbox/action-inbox-helpers";

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
  department_slug?: string | null;
  brief_summary?: string | null;
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
  return trimmed || "Enquiry captured";
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
      const departmentSlug = resolveTicketDepartmentSlug({
        department_slug: ticket.department_slug ?? null,
        summary: ticket.summary ?? "",
      });
      return {
        id: ticket.id,
        href: departmentTicketHref(ticket.id, departmentSlug),
        title: ticketCallerLabel(ticket),
        description: truncateHomePanelDescription(
          departmentListPreview({
            summary: ticket.summary ?? "",
            briefSummary: ticket.brief_summary?.trim() || undefined,
          }),
        ),
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

export function buildHomePostCallAttentionRows(input: {
  calls: HomeAttentionCallRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;

  return [...input.calls]
    .filter((call) => isPostCallAttentionStatus(call.post_call_status))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((call) => ({
      id: `post-call-${call.id}`,
      href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(call.id)}`,
      title: ticketCallerLabel(call),
      description: truncateHomePanelDescription(
        "Processing issue — the shop order may not be fully synced yet.",
      ),
      time: input.formatTime(call.created_at),
    }));
}

export function mergeHomeNeedsAttentionRows(input: {
  tickets: HomeRequestTicketRow[];
  calls: HomeAttentionCallRow[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeRequestRow[] {
  const limit = input.limit ?? 5;
  const ticketRows = buildHomeTodaysRequestRows({
    tickets: input.tickets,
    formatTime: input.formatTime,
    limit,
  });
  const callRows = buildHomePostCallAttentionRows({
    calls: input.calls,
    formatTime: input.formatTime,
    limit,
  });

  return [...ticketRows, ...callRows]
    .sort((a, b) => {
      const ta = Date.parse(a.time);
      const tb = Date.parse(b.time);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
      return 0;
    })
    .slice(0, limit);
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
    if (isPostCallAttentionStatus(call.post_call_status)) generalEnquiries += 1;
    else if (outcome === "callback_requested") callbackRequests += 1;
    else if (isCallNeedingHomeAttention(call.outcome, call.post_call_status)) {
      generalEnquiries += 1;
    }
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

function caraTrainingRowTitle(_status: string | null | undefined): string {
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
        href: DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(item.id),
        title: caraTrainingRowTitle(item.status),
        description: truncateHomePanelDescription(summary),
        time: input.formatTime(item.updated_at),
      };
    });
}
