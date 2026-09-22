import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";

export type CallsIncomingPlaceholder = {
  phase: "in_progress" | "loading";
  callerNumber: string | null;
  callLogId: string | null;
  startedAt: string;
  usageRecordId?: string | null;
};

export function incomingCallPlaceholderKey(
  placeholder: Pick<
    CallsIncomingPlaceholder,
    "callLogId" | "usageRecordId" | "startedAt"
  >,
): string {
  if (placeholder.callLogId) return `call-${placeholder.callLogId}`;
  if (placeholder.usageRecordId) return `usage-${placeholder.usageRecordId}`;
  return `started-${placeholder.startedAt}`;
}

export function upsertIncomingCallPlaceholder(
  current: CallsIncomingPlaceholder[],
  detail: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder[] {
  const map = new Map(
    current.map((placeholder) => [
      incomingCallPlaceholderKey(placeholder),
      placeholder,
    ]),
  );

  const linked =
    (detail.callLogId
      ? current.find((placeholder) => placeholder.callLogId === detail.callLogId)
      : null) ??
    (detail.startedAt
      ? current.find((placeholder) => {
          if (placeholder.callLogId) return false;
          const delta = Math.abs(
            new Date(placeholder.startedAt).getTime() -
              new Date(detail.startedAt!).getTime(),
          );
          return delta <= 5_000;
        })
      : null);

  const merged = mergeIncomingCallEvent(linked ?? null, detail);
  map.set(incomingCallPlaceholderKey(merged), merged);

  return [...map.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function filterActiveIncomingCallPlaceholders(
  placeholders: CallsIncomingPlaceholder[],
  calls: ReadonlyArray<{ id: string; createdAt: string }>,
): CallsIncomingPlaceholder[] {
  return placeholders.filter(
    (placeholder) => !shouldClearCallsIncomingPlaceholder(placeholder, calls),
  );
}

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
      usageRecordId: current?.usageRecordId ?? event.usageRecordId ?? null,
      startedAt,
    };
  }

  return {
    phase: "in_progress",
    callerNumber: event.callerNumber ?? current?.callerNumber ?? null,
    callLogId: current?.callLogId ?? null,
    usageRecordId: event.usageRecordId ?? current?.usageRecordId ?? null,
    startedAt,
  };
}
