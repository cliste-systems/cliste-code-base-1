import type { SupabaseClient } from "@supabase/supabase-js";

import { formatBookingValueEur, sumAppointmentBookingValueEur } from "@/lib/booking-value";

/** Rolling windows (days) included in Cara’s salon snapshot for performance questions. */
export const CARA_ROLLING_WINDOW_DAYS = [7, 14, 21, 28, 42, 56, 90] as const;

export type CaraRollingWindowDay = (typeof CARA_ROLLING_WINDOW_DAYS)[number];

export type CaraRollingWindowStats = {
  days: CaraRollingWindowDay;
  rangeStartIso: string;
  aiCallsLogged: number | null;
  /** Native: sum of service prices for confirmed+completed appointments created in range. */
  bookingValueCreatedEur: number | null;
  /** Native: confirmed visits whose start_time is in [rangeStart, now]. */
  confirmedVisitsStarted: number | null;
};

function startIsoForRollingDays(days: number, nowMs: number): string {
  return new Date(nowMs - days * 864e5).toISOString();
}

/**
 * Parallel aggregates for fixed rolling windows (RLS-scoped).
 */
export async function loadCaraRollingPerformanceWindows(
  supabase: SupabaseClient,
  organizationId: string,
  opts: { nowIso: string; isNative: boolean },
): Promise<CaraRollingWindowStats[]> {
  const nowMs = Date.parse(opts.nowIso);
  const nowIso = opts.nowIso;
  if (!Number.isFinite(nowMs)) {
    throw new Error("loadCaraRollingPerformanceWindows: invalid nowIso");
  }

  const tasks: Promise<unknown>[] = [];

  for (const days of CARA_ROLLING_WINDOW_DAYS) {
    const rangeStartIso = startIsoForRollingDays(days, nowMs);
    tasks.push(
      Promise.resolve(
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", rangeStartIso)
          .lte("created_at", nowIso),
      ),
    );
    if (opts.isNative) {
      tasks.push(
        sumAppointmentBookingValueEur(supabase, {
          organizationId,
          rangeStartIso,
          rangeEndExclusiveIso: null,
        }),
      );
      tasks.push(
        Promise.resolve(
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "confirmed")
            .gte("start_time", rangeStartIso)
            .lte("start_time", nowIso),
        ),
      );
    }
  }

  const settled = await Promise.all(tasks);

  const out: CaraRollingWindowStats[] = [];
  let i = 0;
  for (const days of CARA_ROLLING_WINDOW_DAYS) {
    const rangeStartIso = startIsoForRollingDays(days, nowMs);
    const callsRes = settled[i++] as {
      error: unknown;
      count: number | null;
    };
    const aiCallsLogged =
      callsRes.error != null ? null : (callsRes.count ?? 0);
    let bookingValueCreatedEur: number | null = null;
    let confirmedVisitsStarted: number | null = null;
    if (opts.isNative) {
      bookingValueCreatedEur = settled[i++] as number;
      const apptRes = settled[i++] as {
        error: unknown;
        count: number | null;
      };
      confirmedVisitsStarted =
        apptRes.error != null ? null : (apptRes.count ?? 0);
    }
    out.push({
      days,
      rangeStartIso,
      aiCallsLogged,
      bookingValueCreatedEur,
      confirmedVisitsStarted,
    });
  }

  return out;
}

export function formatCaraRollingPerformanceBlock(
  rows: CaraRollingWindowStats[],
  isNative: boolean,
): string {
  const header =
    "Rolling performance windows (UTC-ish ranges: created_at / start_time from each row’s “N days ago” through now). Use the row whose N matches the user (e.g. 3 weeks → 21 days, 2 weeks → 14 days). If they ask for a period between two rows, cite the closest wider row and say it covers at least that span.";

  const lines = rows.map((r) => {
    const calls = r.aiCallsLogged ?? "unknown";
    if (!isNative) {
      return `- ${r.days}d: AI calls logged: ${calls}.`;
    }
    return (
      `- ${r.days}d: AI calls logged: ${calls}; ` +
      `booking value from appointments **created** in window: ${r.bookingValueCreatedEur != null ? formatBookingValueEur(r.bookingValueCreatedEur) : "unknown"}; ` +
      `confirmed visits **started** in window: ${r.confirmedVisitsStarted ?? "unknown"}.`
    );
  });

  const footer =
    "These rows are full aggregates for the windows above. The “Recent AI calls” list later is only a short newest sample for context.";

  return [header, ...lines, footer].join("\n");
}
