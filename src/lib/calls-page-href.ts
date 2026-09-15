import {
  callsPageDateForTimestamp,
  formatCallsPageDateParam,
  isCallsPageToday,
  parseCallsPageDateParam,
} from "@/lib/calls-page-date";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export function buildCallsPageHref(
  input: {
    callLogId?: string | null;
    callCreatedAt?: string | null;
    page?: number;
    date?: string | null;
  },
  now: Date = new Date(),
): string {
  const callId = String(input.callLogId ?? "").trim();
  const params = new URLSearchParams();

  if (callId) {
    params.set("call", callId);
  }

  const explicitDate = String(input.date ?? "").trim();
  const createdAt = String(input.callCreatedAt ?? "").trim();
  const dateParam =
    explicitDate ||
    (createdAt ? callsPageDateForTimestamp(createdAt, now) : "");

  if (dateParam && !isCallsPageToday(parseCallsPageDateParam(dateParam, now), now)) {
    params.set("date", dateParam);
  }

  if (input.page != null && input.page > 1) {
    params.set("page", String(input.page));
  }

  const qs = params.toString();
  if (!qs) return DASHBOARD_ROUTES.calls;
  return `${DASHBOARD_ROUTES.calls}?${qs}`;
}