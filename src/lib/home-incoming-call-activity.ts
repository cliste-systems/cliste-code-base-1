import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { CallsIncomingPlaceholder } from "@/lib/calls-incoming-placeholder";
import { incomingCallListLabel } from "@/lib/dashboard-feed-time";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export function activityRowsToCallRefs(
  activity: TimelineFeedRow[],
): Array<{ id: string; createdAt: string }> {
  return activity.flatMap((row) => {
    const match = row.href.match(/[?&]call=([^&]+)/);
    if (!match?.[1] || !row.isoDate) return [];
    return [{ id: decodeURIComponent(match[1]), createdAt: row.isoDate }];
  });
}

export function buildHomeIncomingActivityRow(
  placeholder: CallsIncomingPlaceholder,
): TimelineFeedRow {
  const label = incomingCallListLabel(placeholder.callerNumber);
  return {
    id: placeholder.callLogId
      ? `incoming-${placeholder.callLogId}`
      : `incoming-${placeholder.startedAt}`,
    title: label.title,
    subtitle: label.subtitle,
    time: placeholder.phase === "loading" ? "Loading" : "Live",
    href: DASHBOARD_ROUTES.calls,
    liveCall: true,
  };
}

export function mergeHomeActivityWithIncomingCalls(
  activity: TimelineFeedRow[],
  placeholders: CallsIncomingPlaceholder[],
  limit: number,
): TimelineFeedRow[] {
  if (placeholders.length === 0) return activity.slice(0, limit);

  const incomingRows = placeholders.map(buildHomeIncomingActivityRow);
  const callLogIds = new Set(
    placeholders.map((placeholder) => placeholder.callLogId).filter(Boolean),
  );

  const withoutDuplicate = activity.filter((row) => {
    for (const callLogId of callLogIds) {
      if (row.id === `${callLogId}-call`) return false;
    }
    return true;
  });

  return [...incomingRows, ...withoutDuplicate].slice(0, limit);
}

/** @deprecated Use mergeHomeActivityWithIncomingCalls */
export function mergeHomeActivityWithIncomingCall(
  activity: TimelineFeedRow[],
  placeholder: CallsIncomingPlaceholder | null,
  limit: number,
): TimelineFeedRow[] {
  return mergeHomeActivityWithIncomingCalls(
    activity,
    placeholder ? [placeholder] : [],
    limit,
  );
}
