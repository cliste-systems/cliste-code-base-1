import { NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/dashboard-session";

type ReportRange = "7d" | "30d" | "90d" | "ytd";

function asReportRange(v: string | null): ReportRange {
  return v === "7d" || v === "90d" || v === "ytd" ? v : "30d";
}

function rangeStart(range: ReportRange): Date {
  const now = new Date();
  if (range === "ytd") return new Date(now.getFullYear(), 0, 1);
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = asReportRange(url.searchParams.get("range"));
  const start = rangeStart(range);
  const end = new Date();

  const { supabase, organizationId } = await requireDashboardSession();

  const [{ data, error }, { data: staffRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `id,
         start_time,
         end_time,
         status,
         source,
         staff_id,
         customer_name,
         customer_phone,
         customer_email,
         payment_status,
         amount_cents,
         service_total_cents,
         deposit_cents,
         balance_due_cents,
         currency,
         booking_reference,
         cancel_reason,
         cancelled_at,
         services ( name, price )`,
      )
      .eq("organization_id", organizationId)
      .gte("start_time", start.toISOString())
      .lt("start_time", end.toISOString())
      .order("start_time", { ascending: false })
      .limit(10000),
    supabase
      .from("profiles")
      .select("id, name")
      .eq("organization_id", organizationId),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staffMap = new Map<string, string>();
  for (const s of staffRows ?? []) {
    if (s?.id && s?.name) staffMap.set(s.id as string, s.name as string);
  }

  const headers = [
    "booking_reference",
    "start_time",
    "end_time",
    "duration_minutes",
    "status",
    "source",
    "stylist",
    "service",
    "service_price_eur",
    "customer_name",
    "customer_phone",
    "customer_email",
    "payment_status",
    "amount_eur",
    "service_total_eur",
    "deposit_eur",
    "balance_due_eur",
    "currency",
    "cancel_reason",
    "cancelled_at",
  ];

  const lines: string[] = [headers.join(",")];

  type Row = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    source: string | null;
    staff_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    payment_status: string | null;
    amount_cents: number | null;
    service_total_cents: number | null;
    deposit_cents: number | null;
    balance_due_cents: number | null;
    currency: string | null;
    booking_reference: string | null;
    cancel_reason: string | null;
    cancelled_at: string | null;
    services: { name: string | null; price: number | null } | unknown;
  };

  const rows = (data ?? []) as Row[];

  for (const r of rows) {
    const startMs = new Date(r.start_time).getTime();
    const endMs = new Date(r.end_time).getTime();
    const duration =
      Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
        ? Math.round((endMs - startMs) / 60000)
        : "";

    const svc = Array.isArray(r.services) ? r.services[0] : r.services;
    const svcName =
      svc && typeof svc === "object" && "name" in svc
        ? (svc as { name: string | null }).name
        : null;
    const svcPrice =
      svc && typeof svc === "object" && "price" in svc
        ? (svc as { price: number | null }).price
        : null;
    const staffName = r.staff_id ? staffMap.get(r.staff_id) ?? null : null;

    const cells = [
      r.booking_reference,
      r.start_time,
      r.end_time,
      duration,
      r.status,
      r.source,
      staffName,
      svcName,
      typeof svcPrice === "number" ? svcPrice.toFixed(2) : "",
      r.customer_name,
      r.customer_phone,
      r.customer_email,
      r.payment_status,
      typeof r.amount_cents === "number" ? (r.amount_cents / 100).toFixed(2) : "",
      typeof r.service_total_cents === "number"
        ? (r.service_total_cents / 100).toFixed(2)
        : "",
      typeof r.deposit_cents === "number" ? (r.deposit_cents / 100).toFixed(2) : "",
      typeof r.balance_due_cents === "number"
        ? (r.balance_due_cents / 100).toFixed(2)
        : "",
      r.currency,
      r.cancel_reason,
      r.cancelled_at,
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  const filename = `cliste-bookings-${range}-${end.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
