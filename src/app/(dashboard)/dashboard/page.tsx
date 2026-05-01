import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Inbox,
  MessageCircle,
  PhoneCall,
  ReceiptText,
  RefreshCw,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";

import { DashboardMetricRangeToggle } from "./dashboard-metric-range-toggle";

import {
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  getDublinCalendarDayEndExclusiveIso,
  parseDashboardMetricRange,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getEffectiveProductTier } from "@/lib/dev-tier-server";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string }>;
};

type ServiceJoin = { name: string | null; price?: number | string | null };

type AppointmentRow = {
  id: string;
  customer_name: string | null;
  start_time: string;
  created_at?: string | null;
  status: string | null;
  source?: string | null;
  staff_id?: string | null;
  payment_status?: string | null;
  amount_cents?: number | null;
  service_total_cents?: number | null;
  deposit_cents?: number | null;
  balance_due_cents?: number | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  services: ServiceJoin | ServiceJoin[] | null;
};

type CallLogRow = {
  id: string;
  created_at: string;
  outcome: string | null;
};

type TicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
};

type StaffRow = {
  id: string;
  name: string | null;
};

type UpcomingBooking = {
  id: string;
  time: string;
  client: string;
  service: string;
  staff: string;
  status: string;
};

type RecentActivityRow = {
  id: string;
  icon: IconComponent;
  event: string;
  context: string;
  time: string;
  timestamp: number;
};

/** Dev-only full mock home (set `CLISTE_DASHBOARD_HOME_MOCK=0` to use live empty states). */
function dashboardHomePresentationMock(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_DASHBOARD_HOME_MOCK !== "0";
}

const DEMO_UPCOMING_BOOKINGS: UpcomingBooking[] = [
  {
    id: "demo-ui-1",
    time: "3:00pm",
    client: "John Murphy",
    service: "Haircut",
    staff: "Brendan",
    status: "Confirmed",
  },
  {
    id: "demo-ui-2",
    time: "4:30pm",
    client: "Aoife Kelly",
    service: "Colour",
    staff: "Lisa",
    status: "Confirmed",
  },
  {
    id: "demo-ui-3",
    time: "5:00pm",
    client: "Lisa Byrne",
    service: "Blow Dry",
    staff: "Sarah",
    status: "Pending",
  },
  {
    id: "demo-ui-4",
    time: "6:00pm",
    client: "Emma Walsh",
    service: "Highlights",
    staff: "Sarah",
    status: "Confirmed",
  },
  {
    id: "demo-ui-5",
    time: "7:00pm",
    client: "Daniel Ryan",
    service: "Beard Trim",
    staff: "Brendan",
    status: "Confirmed",
  },
];

const MOCK_RECENT_ACTIVITY: RecentActivityRow[] = [
  {
    id: "mock-ra-1",
    icon: CalendarPlus,
    event: "Booking created",
    context: "John Murphy",
    time: "10:42am",
    timestamp: 5,
  },
  {
    id: "mock-ra-2",
    icon: CircleDollarSign,
    event: "Payment received",
    context: "€45.00",
    time: "10:15am",
    timestamp: 4,
  },
  {
    id: "mock-ra-3",
    icon: RefreshCw,
    event: "Booking rescheduled",
    context: "Lisa Byrne",
    time: "9:58am",
    timestamp: 3,
  },
  {
    id: "mock-ra-4",
    icon: ReceiptText,
    event: "Action ticket created",
    context: "Patch test",
    time: "9:21am",
    timestamp: 2,
  },
  {
    id: "mock-ra-5",
    icon: XCircle,
    event: "Appointment cancelled",
    context: "Emma Walsh",
    time: "8:47am",
    timestamp: 1,
  },
];

/** Max rows rendered inside home cards (no inner scroll; partial rows avoided). */
const DASHBOARD_HOME_MAX_UPCOMING_ROWS_VISIBLE = 3;
const DASHBOARD_HOME_MAX_RECENT_ACTIVITY_ROWS_VISIBLE = 3;
/** Cap rows pulled for home aggregates / activity (smaller payload, faster TTFB). */
const DASHBOARD_HOME_APPOINTMENTS_IN_RANGE_LIMIT = 100;
const DASHBOARD_HOME_CALL_LOG_SAMPLE_LIMIT = 80;

function countExact(res: {
  count: number | null;
  error: { message: string } | null;
}): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

function serviceFromJoin(services: AppointmentRow["services"]): ServiceJoin | null {
  if (!services) return null;
  if (Array.isArray(services)) return services[0] ?? null;
  return services;
}

function serviceNameFromJoin(services: AppointmentRow["services"]): string {
  return serviceFromJoin(services)?.name?.trim() || "Service";
}

function centsFromAppointment(row: AppointmentRow): number {
  if (typeof row.service_total_cents === "number") return row.service_total_cents;
  if (typeof row.amount_cents === "number") return row.amount_cents;

  const rawPrice = serviceFromJoin(row.services)?.price;
  const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice ?? 0);
  return Number.isFinite(price) ? Math.round(price * 100) : 0;
}

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);
}

function formatCompactTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString("en-IE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "")
    .toLowerCase();
}

function titleCaseStatus(status: string | null | undefined): string {
  const value = String(status ?? "").trim();
  if (!value) return "Pending";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Attention row title; mock uses singular “follow-up” for counts 1–2. */
function followUpAttentionTitle(count: number): string {
  if (count === 0) return "0 follow-ups needed";
  if (count === 1) return "1 follow-up needed";
  if (count === 2) return "2 follow-up needed";
  return `${count} follow-ups needed`;
}

function isSuccessfulOutcome(outcome: string | null): boolean {
  const value = String(outcome ?? "").toLowerCase();
  return Boolean(value && value !== "hung_up" && value !== "no_answer");
}

const ACTIVITY_CONTEXT_MAX = 20;

function stripBracketTags(s: string): string {
  return s.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Short context for dashboard activity rows (no raw ticket dumps). */
function formatTicketActivityContext(summary: string | null | undefined): string {
  const raw = String(summary ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "Follow-up";

  const lower = raw.toLowerCase();
  if (lower.includes("smoke test") || lower.includes("realtime")) return "Action item";
  if (lower.includes("patch")) return "Patch test";
  if (lower.includes("payment")) return "Payment";
  if (lower.includes("callback")) return "Callback";
  if (lower.includes("message")) return "Message";
  if (lower.includes("resched")) return "Reschedule";

  const cleaned = stripBracketTags(raw);
  const base = cleaned || "Action item";
  return truncateActivityText(base, ACTIVITY_CONTEXT_MAX);
}

function truncateActivityText(text: string, max = ACTIVITY_CONTEXT_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

function DashboardCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  /** Tighter padding and title block for dense lists (e.g. attention inbox). */
  compact = false,
  /** When false, body does not grow (removes empty white band below short lists). */
  fillBody = true,
}: {
  title: string;
  icon?: IconComponent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  fillBody?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        compact ? "px-4 py-3.5" : "px-6 py-5",
        fillBody ? "h-full" : "h-auto",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-4",
          compact ? "mb-2" : "mb-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <Icon
              className={cn("shrink-0 text-[#64748b]", compact ? "size-4" : "size-5")}
              aria-hidden
            />
          ) : null}
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-[#0f172a]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          fillBody ? "min-h-0 flex-1" : "min-h-0 shrink-0",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function CardLink({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "onDark";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[13px] font-medium transition-colors",
        variant === "onDark"
          ? "text-[#e2e8f0] hover:text-white"
          : "text-[#64748b] hover:text-[#0f172a]",
      )}
    >
      <span>{children}</span>
      <span aria-hidden className="font-normal">
        →
      </span>
    </Link>
  );
}

function UpcomingBookingsCard({
  rows,
  scheduledCount,
}: {
  rows: UpcomingBooking[];
  /** Total bookings for today (footer); may exceed visible `rows`. */
  scheduledCount: number;
}) {
  return (
    <section className="relative flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#1c1f26]/18 bg-[linear-gradient(128deg,#3f4451_0%,#303641_35%,#252b34_62%,#1c1f26_100%)] px-4 py-3 text-white shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(ellipse_90%_60%_at_10%_-15%,rgba(255,255,255,0.26),transparent_55%),radial-gradient(circle_at_92%_6%,rgba(255,255,255,0.1),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_38%)]"
        aria-hidden
      />
      <div className="relative flex min-h-0 flex-col overflow-hidden">
        <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarDays className="size-5 shrink-0 text-[#f8fafc]" aria-hidden />
            <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-[#f8fafc]">
              Today&apos;s upcoming bookings
            </h2>
          </div>
          <CardLink href="/dashboard/calendar" variant="onDark">
            View calendar
          </CardLink>
        </div>

        <div className="w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-hidden">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[12px]">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[21%]" />
              <col className="w-[19%]" />
              <col className="w-[17%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/[0.14]">
                <th className="pb-1 pr-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#cbd5e1]">
                  Time
                </th>
                <th className="pb-1 pr-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#cbd5e1]">
                  Client
                </th>
                <th className="pb-1 pr-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#cbd5e1]">
                  Service
                </th>
                <th className="pb-1 pr-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#cbd5e1]">
                  Staff
                </th>
                <th className="pb-1 text-right text-[10px] font-medium uppercase tracking-wide text-[#cbd5e1]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.12]">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="h-[30px]">
                    <td className="max-w-0 truncate py-0 pr-2 align-middle tabular-nums text-[#f8fafc]/90">
                      {row.time}
                    </td>
                    <td className="max-w-0 truncate py-0 pr-2 align-middle font-medium text-[#f8fafc]">
                      {row.client}
                    </td>
                    <td className="max-w-0 truncate py-0 pr-2 align-middle text-[#f8fafc]/90">
                      {row.service}
                    </td>
                    <td className="max-w-0 truncate py-0 pr-2 align-middle text-[#f8fafc]/90">
                      {row.staff}
                    </td>
                    <td className="py-0 pl-1 text-right align-middle">
                      <span
                        className={cn(
                          "inline-flex max-w-full items-center justify-center rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium shadow-sm ring-1 ring-black/[0.06]",
                          row.status === "Pending"
                            ? "text-[#64748b]"
                            : "text-[#0f172a]",
                        )}
                      >
                        <span className="mr-1 size-1 shrink-0 rounded-full bg-[#94a3b8]" />
                        <span className="truncate">{row.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 align-middle text-center text-[13px] text-[#e2e8f0]/90"
                  >
                    No bookings scheduled for the rest of today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-1.5 flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.14] pt-2 pb-0.5 text-[12px] text-[#e2e8f0]">
          <span>{pluralize(scheduledCount, "booking")} scheduled</span>
          <CardLink href="/dashboard/bookings" variant="onDark">
            View all bookings
          </CardLink>
        </div>
      </div>
    </section>
  );
}

function AttentionCard({
  followUps,
  payments,
  reviews,
  singlePaymentSubline,
  className,
}: {
  followUps: number;
  payments: number;
  reviews: number;
  singlePaymentSubline: string | null;
  className?: string;
}) {
  const conversationTitle = `${reviews} ${reviews === 1 ? "conversation" : "conversations"} ${reviews === 1 ? "needs" : "need"} review`;

  const rows = [
    {
      icon: PhoneCall,
      title: followUpAttentionTitle(followUps),
      description: "Clients waiting for your response",
      href: "/dashboard/action-inbox",
    },
    {
      icon: CreditCard,
      title: `${pluralize(payments, "payment")} not completed`,
      description:
        payments === 1 && singlePaymentSubline
          ? singlePaymentSubline
          : payments === 1
            ? "Requires action"
            : "Require action",
      href: "/dashboard/payments",
    },
    {
      icon: MessageCircle,
      title: conversationTitle,
      description: "Caller requested staff follow-up",
      href: "/dashboard/call-history",
    },
  ];

  return (
    <DashboardCard
      title="Needs your attention"
      icon={Inbox}
      className={cn("min-h-0", className)}
      compact
      fillBody
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 divide-y divide-[#e2e8f0]">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <Link
                key={row.title}
                href={row.href}
                className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0 sm:gap-2.5"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-snug text-[#0f172a]">
                    {row.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] leading-snug text-[#64748b]">
                    {row.description}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-[#cbd5e1]" aria-hidden />
              </Link>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 bg-[#fcfcfd]" aria-hidden />
      </div>
    </DashboardCard>
  );
}

function CaraRevenueTodayCard({
  total,
  callsHandled,
  bookingsCreated,
  callRevenue,
  successRate,
  latestOutcome,
  className,
}: {
  total: string;
  callsHandled: string;
  bookingsCreated: string;
  callRevenue: string;
  successRate: string;
  latestOutcome: string;
  className?: string;
}) {
  const metrics = [
    { value: callsHandled, label: "Calls handled" },
    { value: bookingsCreated, label: "Bookings created" },
    { value: callRevenue, label: "Call revenue" },
    { value: successRate, label: "Success rate" },
  ];

  return (
    <DashboardCard
      title="Cara & revenue today"
      icon={Sparkles}
      className={cn("min-h-0", className)}
      compact
      fillBody
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-[28px] font-semibold leading-[0.95] tracking-tight text-[#0f172a] sm:text-[32px]">
              {total}
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-[#64748b]">Total revenue today</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
            <span className="font-semibold text-[#0f172a]">Cara</span>
            <span className="text-[#cbd5e1]" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              Active
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5 text-[13px] leading-snug">
          {metrics.map((metric, index) => (
            <Fragment key={metric.label}>
              {index > 0 ? (
                <span className="select-none px-0.5 text-[#cbd5e1]" aria-hidden>
                  ·
                </span>
              ) : null}
              <span className="inline-flex min-w-0 items-baseline gap-1">
                <span className="font-semibold tabular-nums text-[#0f172a]">{metric.value}</span>
                <span className="text-[#64748b]">{metric.label}</span>
              </span>
            </Fragment>
          ))}
        </div>

        <div className="border-t border-[#eef1f4] pt-3">
          <p className="text-[11px] font-medium text-[#64748b]">Latest outcome</p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[#0f172a]">{latestOutcome}</p>
        </div>

        <div className="mt-auto flex min-h-0 flex-wrap gap-x-5 gap-y-1 border-t border-[#eef1f4] pt-3 text-[12px]">
          <CardLink href="/dashboard/call-history">View Cara activity</CardLink>
          <CardLink href="/dashboard/payments">View payments</CardLink>
        </div>
      </div>
    </DashboardCard>
  );
}

function RecentActivityCard({
  rows,
  className,
}: {
  rows: RecentActivityRow[];
  className?: string;
}) {
  return (
    <DashboardCard
      title="Recent activity"
      icon={Clock}
      action={<CardLink href="/dashboard/call-history">View all activity</CardLink>}
      className={cn("min-h-0", className)}
      compact
      fillBody
    >
      {rows.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#eef1f4] bg-[#fcfcfd]">
          <ul className="shrink-0 divide-y divide-[#e2e8f0]">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.id} className="min-h-0 overflow-hidden">
                  <div className="flex h-8 min-h-0 items-center gap-1.5 overflow-hidden px-2 sm:gap-2 sm:px-2.5">
                    <span className="flex w-6 shrink-0 justify-center sm:w-7">
                      <Icon className="size-[15px] shrink-0 text-[#64748b] sm:size-4" aria-hidden />
                    </span>
                    <span className="w-[8.5rem] shrink-0 truncate whitespace-nowrap text-[12px] font-semibold text-[#0f172a] sm:w-[9.75rem]">
                      {row.event}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#64748b]">
                      {row.context}
                    </span>
                    <span className="w-[4rem] shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums text-[#64748b] sm:w-[4.25rem]">
                      {row.time}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="min-h-0 flex-1 bg-[#fcfcfd]" aria-hidden />
        </div>
      ) : (
        <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#e2e8f0] bg-[#fcfcfd] px-4 py-10 text-center text-[13px] text-[#64748b]">
          No recent activity yet.
        </div>
      )}
    </DashboardCard>
  );
}

function ShortcutsCard() {
  const shortcuts = [
    { label: "Create booking", href: "/dashboard/bookings", icon: CalendarPlus },
    { label: "Cancel booking", href: "/dashboard/bookings", icon: XCircle },
    { label: "Review payments", href: "/dashboard/payments", icon: WalletCards },
    { label: "Open Cara", href: "/cara", icon: MessageCircle },
  ];

  return (
    <DashboardCard
      title="Shortcuts"
      icon={ReceiptText}
      className="min-h-0"
      compact
      fillBody={false}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={shortcut.label}
              href={shortcut.href}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-[#e2e8f0] bg-white px-1.5 py-2 text-center text-[12px] font-medium leading-snug text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-[#cbd5e1] hover:bg-[#fcfcfd] sm:min-h-[76px] sm:px-2 sm:py-2.5"
            >
              <Icon className="size-6 shrink-0 text-[#64748b]" aria-hidden />
              <span className="max-w-[6.75rem] leading-snug sm:max-w-[7.25rem]">
                {shortcut.label}
              </span>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}

type DashboardHomePanelsProps = {
  displayUpcoming: UpcomingBooking[];
  displayCallsHandled: string;
  displayBookingsCreatedMetric: string;
  displayCallRevenue: string;
  displaySuccessRate: string;
  displayLatestOutcome: string;
  displayFollowUps: number;
  displayPaymentsCount: number;
  displayReviewsCount: number;
  displayPaymentSubline: string | null;
  displayRevenueTotal: string;
  displayRecentActivity: RecentActivityRow[];
};

function DashboardHomePanels({
  displayUpcoming,
  displayCallsHandled,
  displayBookingsCreatedMetric,
  displayCallRevenue,
  displaySuccessRate,
  displayLatestOutcome,
  displayFollowUps,
  displayPaymentsCount,
  displayReviewsCount,
  displayPaymentSubline,
  displayRevenueTotal,
  displayRecentActivity,
}: DashboardHomePanelsProps) {
  const bookingsRows = displayUpcoming.slice(0, DASHBOARD_HOME_MAX_UPCOMING_ROWS_VISIBLE);
  const activityRows = displayRecentActivity.slice(
    0,
    DASHBOARD_HOME_MAX_RECENT_ACTIVITY_ROWS_VISIBLE,
  );

  /** Small render helpers keep props in one place. */
  const renderUpcoming = () => (
    <UpcomingBookingsCard rows={bookingsRows} scheduledCount={displayUpcoming.length} />
  );
  const renderAttention = () => (
    <AttentionCard
      followUps={displayFollowUps}
      payments={displayPaymentsCount}
      reviews={displayReviewsCount}
      singlePaymentSubline={displayPaymentSubline}
      className="h-full min-h-0"
    />
  );
  const renderCaraRevenue = (revenueClassName?: string) => (
    <CaraRevenueTodayCard
      total={displayRevenueTotal}
      callsHandled={displayCallsHandled}
      bookingsCreated={displayBookingsCreatedMetric}
      callRevenue={displayCallRevenue}
      successRate={displaySuccessRate}
      latestOutcome={displayLatestOutcome}
      className={revenueClassName}
    />
  );
  const renderRecent = () => <RecentActivityCard rows={activityRows} className="h-full min-h-0" />;
  const renderShortcuts = () => <ShortcutsCard />;

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Dashboard overview">
      {/* lg+: upcoming | Cara+revenue; attention row-span-2 (col1) | recent row-span-2 (col2) */}
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{renderUpcoming()}</div>
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          {renderCaraRevenue("flex-1")}
        </div>
        <div className="min-w-0 flex flex-col lg:col-start-1 lg:row-start-2 lg:row-span-2 lg:h-full lg:min-h-0">
          {renderAttention()}
        </div>
        <div className="min-w-0 flex min-h-0 flex-col lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:h-full">
          {renderRecent()}
        </div>
      </div>
      {renderShortcuts()}
    </section>
  );
}

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const { supabase, organizationId } = await requireDashboardSession();

  const sp = searchParams ? await searchParams : {};
  const metricRange: DashboardMetricRangeKey = parseDashboardMetricRange(sp.range);
  const rangeStartIso = getDashboardMetricRangeLowerBoundIso(metricRange);
  const rangeEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso(metricRange);
  const todayEndIso = getDublinCalendarDayEndExclusiveIso();
  const nowIso = new Date().toISOString();

  const orgRow = await getCachedDashboardOrganizationRow();
  const productTier = await getEffectiveProductTier(orgRow?.tier);
  const isNativeOrg = productTier === "native";

  const callsInRangeQuery = supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso);
  if (rangeEndExclusiveIso) {
    callsInRangeQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const callRowsQuery = supabase
    .from("call_logs")
    .select("id, created_at, outcome")
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso)
    .order("created_at", { ascending: false })
    .limit(DASHBOARD_HOME_CALL_LOG_SAMPLE_LIMIT);
  if (rangeEndExclusiveIso) {
    callRowsQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const bookingsInRangeQuery = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso);
  if (rangeEndExclusiveIso) {
    bookingsInRangeQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const appointmentRowsQuery = supabase
    .from("appointments")
    .select(
      "id, customer_name, start_time, created_at, status, source, staff_id, payment_status, amount_cents, service_total_cents, deposit_cents, balance_due_cents, paid_at, cancelled_at, services ( name, price )",
    )
    .eq("organization_id", organizationId)
    .gte("created_at", rangeStartIso)
    .order("created_at", { ascending: false })
    .limit(DASHBOARD_HOME_APPOINTMENTS_IN_RANGE_LIMIT);
  if (rangeEndExclusiveIso) {
    appointmentRowsQuery.lt("created_at", rangeEndExclusiveIso);
  }

  const [
    callsInRangeRes,
    callRowsRes,
    openTicketsRes,
    recentTicketsRes,
    upcomingRes,
    staffRes,
    bookingsInRangeRes,
    appointmentRowsRes,
  ] = await Promise.all([
    callsInRangeQuery,
    callRowsQuery,
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    supabase
      .from("action_tickets")
      .select("id, summary, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    isNativeOrg
      ? supabase
          .from("appointments")
          .select("id, customer_name, start_time, status, staff_id, services ( name )")
          .eq("organization_id", organizationId)
          .gte("start_time", nowIso)
          .lt("start_time", todayEndIso)
          .neq("status", "cancelled")
          .order("start_time", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    isNativeOrg
      ? supabase
          .from("profiles")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("role", ["staff", "admin"])
      : Promise.resolve({ data: [], error: null }),
    isNativeOrg ? bookingsInRangeQuery : Promise.resolve({ count: 0, error: null }),
    isNativeOrg ? appointmentRowsQuery : Promise.resolve({ data: [], error: null }),
  ]);

  const callsInRange = countExact(callsInRangeRes);
  const openTickets = countExact(openTicketsRes);
  const bookingsCreated = countExact(bookingsInRangeRes);
  const callRows = (callRowsRes.error ? [] : (callRowsRes.data ?? [])) as CallLogRow[];
  const successfulCalls = callRows.filter((row) => isSuccessfulOutcome(row.outcome)).length;
  const successRate =
    callsInRange > 0 ? `${Math.round((successfulCalls / callsInRange) * 100)}%` : "0%";

  const staffRows = (staffRes.error ? [] : (staffRes.data ?? [])) as StaffRow[];
  const staffById = new Map(
    staffRows.map((staff) => [staff.id, staff.name?.trim() || "Staff"]),
  );

  const upcomingRows = (upcomingRes.error
    ? []
    : ((upcomingRes.data ?? []) as AppointmentRow[])).map((row) => ({
    id: row.id,
    time: formatCompactTime(row.start_time),
    client: row.customer_name?.trim() || "Client",
    service: serviceNameFromJoin(row.services),
    staff: row.staff_id ? staffById.get(row.staff_id) ?? "Staff" : "Staff",
    status: titleCaseStatus(row.status),
  }));

  const appointmentRows = (appointmentRowsRes.error
    ? []
    : ((appointmentRowsRes.data ?? []) as AppointmentRow[]));
  const totalRevenueCents = appointmentRows
    .filter((row) => row.status === "confirmed" || row.status === "completed")
    .reduce((sum, row) => sum + centsFromAppointment(row), 0);
  const pendingRows = appointmentRows.filter((row) =>
    ["pending", "unpaid", "requires_action"].includes(row.payment_status ?? ""),
  );
  const firstPending = pendingRows[0];
  const firstPendingCents = firstPending
    ? (firstPending.balance_due_cents ?? firstPending.amount_cents ?? 0)
    : 0;
  const singlePaymentSubline =
    pendingRows.length === 1 ? `${formatEuroFromCents(firstPendingCents)} requires action` : null;
  const caraCallsCents = appointmentRows
    .filter((row) => row.source === "ai_call")
    .reduce((sum, row) => sum + centsFromAppointment(row), 0);
  const reviewCount = callRows.filter((row) =>
    ["message_taken", "hung_up", "no_answer"].includes(row.outcome ?? ""),
  ).length;

  const presentationMock = dashboardHomePresentationMock();

  const latestAiBooking = appointmentRows.find((row) => row.source === "ai_call");
  const latestOutcome = latestAiBooking
    ? `Booking created at ${formatCompactTime(latestAiBooking.start_time)}`
    : callRows[0]
      ? "Call handled by Cara"
      : "No Cara activity yet";

  const recentTicketRows = (recentTicketsRes.error
    ? []
    : ((recentTicketsRes.data ?? []) as TicketRow[]));
  const recentActivities: RecentActivityRow[] = [
    ...appointmentRows.slice(0, 10).flatMap((row) => {
      const clientShort = truncateActivityText(row.customer_name?.trim() || "Client");
      const base = {
        context: clientShort,
        timestamp: new Date(row.created_at ?? row.start_time).getTime(),
        time: formatCompactTime(row.created_at ?? row.start_time),
      };
      if (row.cancelled_at || row.status === "cancelled") {
        return [
          {
            id: `${row.id}-cancelled`,
            icon: XCircle,
            event: "Appointment cancelled",
            context: clientShort,
            timestamp: new Date(
              row.cancelled_at ?? row.created_at ?? row.start_time,
            ).getTime(),
            time: formatCompactTime(
              row.cancelled_at ?? row.created_at ?? row.start_time,
            ),
          },
        ];
      }
      if (row.paid_at || row.payment_status === "paid") {
        return [
          {
            id: `${row.id}-paid`,
            icon: CircleDollarSign,
            event: "Payment received",
            context: formatEuroFromCents(row.amount_cents ?? centsFromAppointment(row)),
            timestamp: new Date(row.paid_at ?? row.created_at ?? row.start_time).getTime(),
            time: formatCompactTime(row.paid_at ?? row.created_at ?? row.start_time),
          },
        ];
      }
      return [
        {
          id: `${row.id}-created`,
          icon: CalendarPlus,
          event: "Booking created",
          ...base,
        },
      ];
    }),
    ...recentTicketRows.map((row) => ({
      id: `${row.id}-ticket`,
      icon: ReceiptText,
      event: "Action ticket created",
      context: formatTicketActivityContext(row.summary),
      timestamp: new Date(row.created_at).getTime(),
      time: formatCompactTime(row.created_at),
    })),
  ]
    .filter((row) => Number.isFinite(row.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const displayUpcoming = presentationMock ? DEMO_UPCOMING_BOOKINGS : upcomingRows;

  const displayCallsHandled = presentationMock ? "23" : String(callsInRange);
  const displayBookingsCreatedMetric = presentationMock ? "6" : String(bookingsCreated);
  const displayCallRevenue = presentationMock ? "€280" : formatEuroFromCents(caraCallsCents);
  const displaySuccessRate = presentationMock ? "92%" : successRate;
  const displayLatestOutcome = presentationMock
    ? "Booking created at 3:00pm"
    : latestOutcome;

  const displayFollowUps = presentationMock ? 2 : openTickets;
  const displayPaymentsCount = presentationMock ? 1 : pendingRows.length;
  const displayReviewsCount = presentationMock ? 1 : reviewCount;
  const displayPaymentSubline = presentationMock
    ? "€65.00 requires action"
    : singlePaymentSubline;

  const displayRevenueTotal = presentationMock ? "€420" : formatEuroFromCents(totalRevenueCents);

  const displayRecentActivity = presentationMock
    ? [...MOCK_RECENT_ACTIVITY].sort((a, b) => b.timestamp - a.timestamp)
    : recentActivities;

  const showBellDot = presentationMock || openTickets > 0;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1320px] flex-1 flex-col overflow-hidden">
      <header className="mb-3 shrink-0 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-[1.15] tracking-tight text-[#0f172a] sm:text-[24px]">
            Good afternoon, Sarah
          </h1>
          <p className="mt-1 text-[14px] text-[#64748b]">
            Your front desk overview for today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Suspense
            fallback={
              <div className="h-[42px] w-64 animate-pulse rounded-full bg-[#f1f5f9]" />
            }
          >
            <DashboardMetricRangeToggle />
          </Suspense>
          <Link
            href="/dashboard/action-inbox"
            className="relative hidden size-[42px] shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a] sm:inline-flex"
            aria-label="Open notifications"
          >
            <Bell className="size-[18px]" aria-hidden />
            {showBellDot ? (
              <span
                className="absolute right-2 top-2 size-2 rounded-full bg-[#64748b]"
                aria-hidden
              />
            ) : null}
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-1 no-scrollbar">
        <DashboardHomePanels
          displayUpcoming={displayUpcoming}
          displayCallsHandled={displayCallsHandled}
          displayBookingsCreatedMetric={displayBookingsCreatedMetric}
          displayCallRevenue={displayCallRevenue}
          displaySuccessRate={displaySuccessRate}
          displayLatestOutcome={displayLatestOutcome}
          displayFollowUps={displayFollowUps}
          displayPaymentsCount={displayPaymentsCount}
          displayReviewsCount={displayReviewsCount}
          displayPaymentSubline={displayPaymentSubline}
          displayRevenueTotal={displayRevenueTotal}
          displayRecentActivity={displayRecentActivity}
        />
      </div>
    </div>
  );
}
