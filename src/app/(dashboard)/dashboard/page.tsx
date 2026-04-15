import type { ComponentType } from "react";
import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Euro,
  Inbox,
  Phone,
  PhoneIncoming,
} from "lucide-react";

import { DashboardMetricRangeToggle } from "./dashboard-metric-range-toggle";

import {
  formatBookingValueEur,
  sumAppointmentBookingValueEur,
} from "@/lib/booking-value";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getEffectiveProductTier } from "@/lib/dev-tier-server";
import {
  dashboardMetricRangePeriodPhrase,
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  parseDashboardMetricRange,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { cn } from "@/lib/utils";

const bookingCtaPrimaryClass =
  "bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none";

const bookingCtaSecondaryDisabledClass =
  "bg-gray-100 text-gray-400 inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-transparent px-4 text-sm font-semibold whitespace-nowrap cursor-not-allowed";

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-IE").format(n);
}

function countExact(
  res: { count: number | null; error: { message: string } | null },
): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCallDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${seconds}s duration`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s duration` : `${m}m duration`;
}

function outcomeDisplayLabel(outcome: string | null | undefined): string {
  const o = String(outcome ?? "").trim().toLowerCase();
  if (!o) return "Unknown";
  const map: Record<string, string> = {
    link_sent: "Link sent",
    message_taken: "Message taken",
    appointment_booked: "Booked",
    booked: "Booked",
    hung_up: "Hung up",
    completed: "Completed",
    no_answer: "No answer",
  };
  const raw = String(outcome ?? "");
  return (
    map[o] ??
    raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function eventBadgeForOutcome(outcome: string | null | undefined): {
  label: string;
  success: boolean;
} {
  const o = String(outcome ?? "").trim().toLowerCase();
  if (o === "no_answer" || o === "hung_up") {
    return { label: outcomeDisplayLabel(outcome), success: false };
  }
  if (!o) return { label: "Logged", success: false };
  return { label: "Handled", success: true };
}

function formatUpcomingSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function serviceNameFromJoin(services: unknown): string | null {
  if (!services) return null;
  if (Array.isArray(services)) {
    const n = (services[0] as { name?: string } | undefined)?.name;
    return typeof n === "string" ? n : null;
  }
  if (typeof services === "object" && services !== null && "name" in services) {
    const n = (services as { name: unknown }).name;
    return typeof n === "string" ? n : null;
  }
  return null;
}

function initialFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

type MetricIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function BentoStatCard({
  label,
  hint,
  value,
  icon: Icon,
  emphasize,
}: {
  label: string;
  hint: string;
  value: string;
  icon: MetricIcon;
  emphasize?: boolean;
}) {
  if (emphasize) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-md">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Inbox className="size-16 text-white md:size-24" aria-hidden />
        </div>
        <h3 className="relative text-sm font-medium text-white">{label}</h3>
        <p className="relative mt-1 text-xs text-gray-400">{hint}</p>
        <div className="relative mt-10 flex items-end justify-between">
          <span className="text-5xl font-light tracking-tighter text-white">
            {value}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors hover:border-gray-300">
      <div className="absolute top-0 right-0 p-6 opacity-20 transition-opacity group-hover:opacity-40">
        <Icon className="size-16 text-gray-400 md:size-24" aria-hidden />
      </div>
      <h3 className="relative text-sm font-medium text-gray-900">{label}</h3>
      <p className="relative mt-1 text-xs text-gray-500">{hint}</p>
      <div className="relative mt-10 flex items-end justify-between">
        <span className="text-5xl font-light tracking-tighter text-gray-900 tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string }>;
};

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const { supabase, organizationId } = await requireDashboardSession();

  const sp = searchParams ? await searchParams : {};
  const metricRange: DashboardMetricRangeKey = parseDashboardMetricRange(
    sp.range,
  );
  const rangeStartIso = getDashboardMetricRangeLowerBoundIso(metricRange);
  const rangeEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso(metricRange);

  const periodPhrase = dashboardMetricRangePeriodPhrase(metricRange);

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("tier, fresha_url")
    .eq("id", organizationId)
    .maybeSingle();

  const productTier = await getEffectiveProductTier(orgRow?.tier);
  const isNativeOrg = productTier === "native";

  const freshaUrl = orgRow?.fresha_url?.trim() ?? "";
  const bookingPlatformHref =
    freshaUrl && /^https?:\/\//i.test(freshaUrl) ? freshaUrl : null;

  const nowIso = new Date().toISOString();

  const callsInRangeQuery = supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso);
  if (rangeEndExclusiveIso) {
    callsInRangeQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const linksInRangeQuery = supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso)
    .eq("outcome", "link_sent");
  if (rangeEndExclusiveIso) {
    linksInRangeQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const nativeBookingsInRangeQuery = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso);
  if (rangeEndExclusiveIso) {
    nativeBookingsInRangeQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const [
    callsInRangeRes,
    linkInRangeRes,
    openTicketsRes,
    feedRes,
    upcomingRes,
    nativeBookingsInRangeRes,
    bookingValueEur,
  ] = await Promise.all([
    callsInRangeQuery,
    linksInRangeQuery,
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    supabase
      .from("call_logs")
      .select(
        "id, created_at, caller_number, outcome, transcript, duration_seconds",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    isNativeOrg
      ? supabase
          .from("appointments")
          .select("id, customer_name, start_time, end_time, services ( name )")
          .eq("organization_id", organizationId)
          .gt("start_time", nowIso)
          .eq("status", "confirmed")
          .order("start_time", { ascending: true })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
    isNativeOrg ? nativeBookingsInRangeQuery : Promise.resolve({ count: 0, error: null }),
    isNativeOrg
      ? sumAppointmentBookingValueEur(supabase, {
          organizationId,
          rangeStartIso,
          rangeEndExclusiveIso,
        })
      : Promise.resolve(0),
  ]);

  const callsInRange = countExact(callsInRangeRes);
  const linkInRange = countExact(linkInRangeRes);
  const nativeBookingsInRange = countExact(nativeBookingsInRangeRes);
  const openTickets = countExact(openTicketsRes);
  const feedRows = feedRes.error ? [] : (feedRes.data ?? []);
  const primaryLog = feedRows[0];

  type UpcomingAppointment = {
    id: string;
    customer_name: string;
    start_time: string;
    services: { name: string } | null | { name: string }[];
  };

  const upcomingRows: UpcomingAppointment[] =
    isNativeOrg && !upcomingRes.error && upcomingRes.data
      ? (upcomingRes.data as UpcomingAppointment[])
      : [];

  const bookingMetric =
    productTier === "connect"
      ? {
          label: "Booking links",
          hint: `Sent via text by AI · ${periodPhrase}`,
          value: formatInt(linkInRange),
          icon: CalendarDays,
        }
      : {
          label: "Appointments",
          hint: `Scheduled by AI · ${periodPhrase}`,
          value: formatInt(nativeBookingsInRange),
          icon: CalendarDays,
        };

  return (
    <div className="relative">
      <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-4xl font-medium tracking-tight text-gray-900">
            Today at a glance
          </h2>
          <p className="mt-3 max-w-lg text-base font-normal text-gray-500">
            An overview of your AI receptionist&apos;s performance and recent
            salon activity.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="h-10 w-full max-w-[22rem] animate-pulse rounded-full bg-gray-100 sm:shrink-0" />
          }
        >
          <DashboardMetricRangeToggle />
        </Suspense>
      </header>

      <div
        className={cn(
          "mb-12 grid grid-cols-1 gap-4",
          isNativeOrg ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3",
        )}
      >
        <BentoStatCard
          label={bookingMetric.label}
          hint={bookingMetric.hint}
          value={bookingMetric.value}
          icon={bookingMetric.icon}
        />
        {isNativeOrg ? (
          <BentoStatCard
            label="Booking value"
            hint={`Confirmed & completed · ${periodPhrase}`}
            value={formatBookingValueEur(bookingValueEur)}
            icon={Euro}
          />
        ) : null}
        <BentoStatCard
          label="Calls handled"
          hint={`Answered by AI · ${periodPhrase}`}
          value={formatInt(callsInRange)}
          icon={Phone}
        />
        <BentoStatCard
          label="Actions required"
          hint="Pending follow-ups"
          value={formatInt(openTickets)}
          icon={Inbox}
          emphasize
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {isNativeOrg ? (
            <>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium tracking-tight text-gray-900">
                    Up next
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upcoming confirmed appointments.
                  </p>
                </div>
                <Link
                  href="/dashboard/bookings"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200/60 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  View all
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {upcomingRows.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-gray-200/80 py-12 text-center text-sm text-gray-500">
                    No upcoming visits. Add bookings under Bookings.
                  </p>
                ) : (
                  upcomingRows.map((row) => {
                    const svc = serviceNameFromJoin(row.services);
                    return (
                      <div
                        key={row.id}
                        className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-gray-300 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gradient-to-tr from-gray-100 to-white text-base font-medium text-gray-700 shadow-sm">
                            {initialFromName(row.customer_name)}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {row.customer_name}
                            </h4>
                            {svc ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium tracking-widest text-gray-600 uppercase">
                                  {svc}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm text-gray-500">
                          <Clock
                            className="size-4 shrink-0 text-gray-400"
                            aria-hidden
                          />
                          <span className="tabular-nums">
                            {formatUpcomingSlot(row.start_time)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-medium tracking-tight text-gray-900">
                  Schedule
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your schedule on your booking platform.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                {bookingPlatformHref ? (
                  <a
                    href={bookingPlatformHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${bookingCtaPrimaryClass} w-full sm:w-auto`}
                  >
                    Open booking platform
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={`${bookingCtaSecondaryDisabledClass} w-full sm:w-auto`}
                  >
                    Open booking platform
                  </button>
                )}
                {!bookingPlatformHref ? (
                  <p className="mt-3 text-xs leading-snug text-gray-500">
                    Add your booking link under Settings to enable the button.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-medium tracking-tight text-gray-900">
              AI Event Log
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Latest autonomous interactions.
            </p>
          </div>

          <div className="relative rounded-2xl border border-gray-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            {feedRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No calls yet. Your AI will log every conversation here.
              </p>
            ) : (
              <>
                <div className="absolute top-8 bottom-8 left-[39px] w-px border-l border-dashed border-gray-200" />

                {primaryLog ? (
                  <div className="relative flex gap-4">
                    <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm">
                      <PhoneIncoming className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pb-6">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        {(() => {
                          const { label, success } = eventBadgeForOutcome(
                            primaryLog.outcome,
                          );
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-widest uppercase",
                                success
                                  ? "border-green-200/50 bg-green-50 text-green-700"
                                  : "border-gray-200/60 bg-gray-50 text-gray-600",
                              )}
                            >
                              {success ? (
                                <span className="size-1 rounded-full bg-green-500" />
                              ) : null}
                              {label}
                            </span>
                          );
                        })()}
                        <span className="text-xs text-gray-400 tabular-nums">
                          {formatFeedTime(primaryLog.created_at)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                        <h4 className="mb-1 text-sm font-medium text-gray-900">
                          Incoming call
                        </h4>
                        <p className="mb-3 font-mono text-xs text-gray-500">
                          {String(primaryLog.caller_number ?? "").trim() ||
                            "Unknown"}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          {typeof primaryLog.duration_seconds === "number" &&
                          primaryLog.duration_seconds > 0 ? (
                            <span className="flex items-center gap-1.5">
                              <Clock
                                className="size-3.5 text-gray-400"
                                aria-hidden
                              />
                              {formatCallDuration(primaryLog.duration_seconds)}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              {outcomeDisplayLabel(primaryLog.outcome)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="relative flex gap-4 opacity-50">
                  <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-300">
                    <span className="size-1.5 rounded-full bg-gray-300" />
                  </div>
                  <div className="flex-1 py-1.5">
                    <p className="text-xs text-gray-400 italic">
                      {feedRows.length > 1
                        ? "Scroll call history for more events."
                        : "Awaiting new events…"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
