import { BarChart3, Download } from "lucide-react";

import { requireDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

type ReportRange = "7d" | "30d" | "90d" | "ytd";

type AppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service_id: string | null;
  staff_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  amount_cents: number | null;
  service_total_cents: number | null;
  payment_status: string | null;
};

type ServiceRow = { id: string; name: string; price: number | null };
type StaffRow = { id: string; name: string | null };

function rangeStart(range: ReportRange): Date {
  const now = new Date();
  if (range === "ytd") {
    return new Date(now.getFullYear(), 0, 1);
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeLabel(range: ReportRange): string {
  switch (range) {
    case "7d":
      return "Last 7 days";
    case "90d":
      return "Last 90 days";
    case "ytd":
      return "Year to date";
    default:
      return "Last 30 days";
  }
}

function asReportRange(v: unknown): ReportRange {
  return v === "7d" || v === "90d" || v === "ytd" ? v : "30d";
}

function fmtEur(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return "€0.00";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function fmtPct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function fmtMinAsHours(min: number): string {
  if (!min) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const range = asReportRange(typeof sp.range === "string" ? sp.range : "30d");
  const start = rangeStart(range);
  const end = new Date();

  const { supabase, organizationId } = await requireDashboardSession();

  const [{ data: apptRows }, { data: serviceRows }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, start_time, end_time, status, service_id, staff_id, customer_name, customer_phone, amount_cents, service_total_cents, payment_status",
        )
        .eq("organization_id", organizationId)
        .gte("start_time", start.toISOString())
        .lt("start_time", end.toISOString())
        .order("start_time", { ascending: false })
        .limit(5000),
      supabase
        .from("services")
        .select("id, name, price")
        .eq("organization_id", organizationId),
      supabase
        .from("profiles")
        .select("id, name, role")
        .eq("organization_id", organizationId)
        .in("role", ["staff", "admin"]),
    ]);

  const appts: AppointmentRow[] = (apptRows ?? []) as AppointmentRow[];
  const services: ServiceRow[] = (serviceRows ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Service",
    price: typeof s.price === "number" ? s.price : null,
  }));
  const staff: StaffRow[] = (staffRows ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string | null) ?? null,
  }));

  const serviceById = new Map(services.map((s) => [s.id, s] as const));
  const staffById = new Map(staff.map((s) => [s.id, s] as const));

  let totalConfirmed = 0;
  let totalCompleted = 0;
  let totalCancelled = 0;
  let totalNoShow = 0;
  let revenueCents = 0;
  let bookedMinutes = 0;
  let depositPendingCents = 0;
  let onlineBookings = 0;

  type Bucket = { count: number; revenue: number };
  const byService = new Map<string, Bucket>();
  const byStaff = new Map<string, Bucket>();
  const byClient = new Map<
    string,
    { name: string; phone: string; visits: number; revenue: number }
  >();

  for (const a of appts) {
    const status = (a.status ?? "").toLowerCase();
    if (status === "confirmed") totalConfirmed += 1;
    else if (status === "completed") totalCompleted += 1;
    else if (status === "cancelled") totalCancelled += 1;
    else if (status === "no_show") totalNoShow += 1;

    const counts = status === "completed" || status === "confirmed";
    const start = new Date(a.start_time).getTime();
    const end = new Date(a.end_time).getTime();
    const minutes =
      Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.round((end - start) / 60000)
        : 0;
    if (counts) bookedMinutes += minutes;

    // Revenue: prefer paid amount_cents, else fall back to service_total_cents
    // for completed visits. Skip cancelled and no-show.
    let lineRevenue = 0;
    if (status === "completed" || status === "confirmed") {
      if (a.payment_status === "paid" && (a.amount_cents ?? 0) > 0) {
        lineRevenue = a.amount_cents ?? 0;
      } else if (
        a.payment_status === "deposit_paid" &&
        (a.service_total_cents ?? 0) > 0
      ) {
        lineRevenue = a.service_total_cents ?? 0;
      } else if ((a.service_total_cents ?? 0) > 0) {
        lineRevenue = a.service_total_cents ?? 0;
      } else if (a.service_id) {
        const svc = serviceById.get(a.service_id);
        if (svc?.price) lineRevenue = Math.round(svc.price * 100);
      }
    }
    revenueCents += lineRevenue;

    if (
      a.payment_status &&
      ["pending", "unpaid", "failed"].includes(a.payment_status)
    ) {
      depositPendingCents += a.amount_cents ?? 0;
    }
    if (a.payment_status) onlineBookings += 1;

    if (a.service_id) {
      const b = byService.get(a.service_id) ?? { count: 0, revenue: 0 };
      b.count += 1;
      b.revenue += lineRevenue;
      byService.set(a.service_id, b);
    }
    if (a.staff_id) {
      const b = byStaff.get(a.staff_id) ?? { count: 0, revenue: 0 };
      b.count += 1;
      b.revenue += lineRevenue;
      byStaff.set(a.staff_id, b);
    }
    const phoneKey = (a.customer_phone ?? "").replace(/\D/g, "");
    if (phoneKey) {
      const c = byClient.get(phoneKey) ?? {
        name: a.customer_name ?? "Client",
        phone: a.customer_phone ?? "",
        visits: 0,
        revenue: 0,
      };
      c.visits += 1;
      c.revenue += lineRevenue;
      // Use the latest seen name (rows are ordered desc; first wins).
      if (!c.name && a.customer_name) c.name = a.customer_name;
      byClient.set(phoneKey, c);
    }
  }

  const totalAppts =
    totalConfirmed + totalCompleted + totalCancelled + totalNoShow;
  const noShowRate = fmtPct(totalNoShow, totalAppts);
  const cancellationRate = fmtPct(totalCancelled, totalAppts);

  const topServices = Array.from(byService.entries())
    .map(([id, b]) => ({
      id,
      name: serviceById.get(id)?.name ?? "Service",
      ...b,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 8);

  const topStaff = Array.from(byStaff.entries())
    .map(([id, b]) => ({
      id,
      name: staffById.get(id)?.name ?? "Stylist",
      ...b,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 8);

  const topClients = Array.from(byClient.values())
    .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits)
    .slice(0, 10);

  const ranges: ReportRange[] = ["7d", "30d", "90d", "ytd"];

  const csvHref = `/api/reports/appointments.csv?range=${range}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <BarChart3 className="size-3.5" aria-hidden />
            Reports
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Salon performance
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {rangeLabel(range)} · {totalAppts.toLocaleString()} bookings ·
            {" "}
            {fmtEur(revenueCents)} revenue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-sm">
            {ranges.map((r) => (
              <a
                key={r}
                href={`/dashboard/reports?range=${r}`}
                className={
                  "rounded px-3 py-1.5 text-xs font-medium transition " +
                  (r === range
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                {r === "ytd" ? "YTD" : r.toUpperCase()}
              </a>
            ))}
          </div>
          <a
            href={csvHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Revenue" value={fmtEur(revenueCents)} />
        <Kpi label="Bookings" value={totalAppts.toLocaleString()} />
        <Kpi label="Completed" value={totalCompleted.toLocaleString()} />
        <Kpi label="Cancelled" value={totalCancelled.toLocaleString()} sub={cancellationRate} />
        <Kpi label="No-shows" value={totalNoShow.toLocaleString()} sub={noShowRate} />
        <Kpi label="Booked time" value={fmtMinAsHours(bookedMinutes)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Online bookings" value={onlineBookings.toLocaleString()} />
        <Kpi label="Pending payment" value={fmtEur(depositPendingCents)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Top services"
          subtitle="By revenue, then booking count"
          empty="No services booked in this range yet."
          rows={topServices.map((s) => ({
            key: s.id,
            primary: s.name,
            secondary: `${s.count} booking${s.count === 1 ? "" : "s"}`,
            value: fmtEur(s.revenue),
          }))}
        />
        <Section
          title="Top stylists"
          subtitle="By revenue attributed to stylist"
          empty="No stylist-attributed bookings in this range."
          rows={topStaff.map((s) => ({
            key: s.id,
            primary: s.name,
            secondary: `${s.count} booking${s.count === 1 ? "" : "s"}`,
            value: fmtEur(s.revenue),
          }))}
        />
        <Section
          title="Top clients"
          subtitle="By revenue across the period"
          empty="No client visits recorded yet."
          rows={topClients.map((c) => ({
            key: c.phone || c.name,
            primary: c.name || "Client",
            secondary: `${c.visits} visit${c.visits === 1 ? "" : "s"} · ${c.phone}`,
            value: fmtEur(c.revenue),
          }))}
        />
        <Section
          title="Status mix"
          subtitle="Where bookings ended up"
          empty="No bookings in this range."
          rows={[
            {
              key: "confirmed",
              primary: "Confirmed (upcoming or in progress)",
              secondary: fmtPct(totalConfirmed, totalAppts),
              value: totalConfirmed.toLocaleString(),
            },
            {
              key: "completed",
              primary: "Completed",
              secondary: fmtPct(totalCompleted, totalAppts),
              value: totalCompleted.toLocaleString(),
            },
            {
              key: "cancelled",
              primary: "Cancelled",
              secondary: fmtPct(totalCancelled, totalAppts),
              value: totalCancelled.toLocaleString(),
            },
            {
              key: "no_show",
              primary: "No-show",
              secondary: fmtPct(totalNoShow, totalAppts),
              value: totalNoShow.toLocaleString(),
            },
          ]}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs text-gray-500 tabular-nums">{sub}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  empty: string;
  rows: Array<{
    key: string;
    primary: string;
    secondary: string;
    value: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-gray-900">
          {title}
        </h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {r.primary}
                </p>
                <p className="truncate text-xs text-gray-500">{r.secondary}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                {r.value}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
