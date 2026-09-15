import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";

export type CallsIncomingPlaceholder = {
  phase: "in_progress" | "loading";
  callerNumber: string | null;
  callLogId: string | null;
  startedAt: string;
};

/** Hide the placeholder when viewing past days or paginated history. */
export function shouldShowCallsIncomingPlaceholder(options: {
  viewingToday: boolean;
  page: number;
  placeholder: CallsIncomingPlaceholder | null;
}): boolean {
  return (
    options.placeholder != null && options.viewingToday && options.page <= 1
  );
}

/** Clear once the refreshed server list includes the new call. */
export function shouldClearCallsIncomingPlaceholder(
  placeholder: CallsIncomingPlaceholder,
  calls: ReadonlyArray<{ id: string; createdAt: string }>,
): boolean {
  if (placeholder.callLogId) {
    return calls.some((call) => call.id === placeholder.callLogId);
  }

  const startedMs = new Date(placeholder.startedAt).getTime();
  if (Number.isNaN(startedMs)) return false;

  return calls.some(
    (call) => new Date(call.createdAt).getTime() >= startedMs - 5_000,
  );
}

export function mergeIncomingCallEvent(
  current: CallsIncomingPlaceholder | null,
  event: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder {
  const startedAt =
    event.startedAt ?? current?.startedAt ?? new Date().toISOString();

  if (event.phase === "loading") {
    return {
      phase: "loading",
      callerNumber: event.callerNumber ?? current?.callerNumber ?? null,
      callLogId: event.callLogId ?? current?.callLogId ?? null,
      startedAt,
    };
  }

  return {
    phase: "in_progress",
    callerNumber: event.callerNumber ?? current?.callerNumber ?? null,
    callLogId: current?.callLogId ?? null,
    startedAt,
  };
}
