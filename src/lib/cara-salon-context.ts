import type { SupabaseClient } from "@supabase/supabase-js";

import { getSalonTimeZone } from "@/lib/booking-available-slots";
import { formatBookingValueEur, sumAppointmentBookingValueEur } from "@/lib/booking-value";
import {
  formatCaraRollingPerformanceBlock,
  loadCaraRollingPerformanceWindows,
} from "@/lib/cara-rolling-performance";
import type { CaraNearTermAppointment } from "@/lib/cara-near-term-appointments";
import {
  CARA_APPOINTMENT_LOOKAHEAD_DAYS,
  loadCaraNearTermConfirmedAppointments,
} from "@/lib/cara-near-term-appointments";
import {
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
} from "@/lib/dashboard-metric-range";
import { getEffectiveProductTier } from "@/lib/dev-tier-server";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatWhen(iso: string): string {
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

type OrgRow = {
  name: string;
  slug: string;
  tier: string;
  niche: string | null;
  greeting: string | null;
  fresha_url: string | null;
};

export type CaraPublishedService = {
  id: string;
  name: string;
  duration_minutes: number;
};

export type CaraSalonSnapshot = {
  /** Prose-oriented facts for the model; not shown to the user. */
  text: string;
  salonName: string;
  userFirstName: string | null;
  isNative: boolean;
  /** Confirmed visits in the upcoming window; used server-side for cancel confirmation (native only). */
  nearTermAppointments: CaraNearTermAppointment[];
  /** Published menu rows for server-side booking-from-chat (not duplicated in `text`). */
  publishedServices: CaraPublishedService[];
};

/**
 * Loads tenant-scoped salon facts (RLS) into a compact snapshot for Cara.
 */
export async function buildCaraSalonSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<CaraSalonSnapshot> {
  const nowIso = new Date().toISOString();
  const yesterdayStartIso = getDashboardMetricRangeLowerBoundIso("yesterday");
  const yesterdayEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso("yesterday")!;

  const [
    orgRes,
    profileRes,
    ticketsRes,
    callsRes,
    servicesRes,
    callsYesterdayRes,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, slug, tier, niche, greeting, fresha_url")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("action_tickets")
      .select("summary, status, created_at, caller_number")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("call_logs")
      .select(
        "outcome, created_at, ai_summary, transcript_review, transcript, duration_seconds, caller_number",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_published")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .limit(40),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", yesterdayStartIso)
      .lt("created_at", yesterdayEndExclusiveIso),
  ]);

  const org = orgRes.data as OrgRow | null;
  const salonName = org?.name?.trim() || "Your salon";
  const profileName =
    typeof profileRes.data?.name === "string"
      ? profileRes.data.name.trim()
      : "";
  const userFirstName = profileName
    ? profileName.split(/\s+/)[0] ?? profileName
    : null;

  const effectiveTier = await getEffectiveProductTier(org?.tier);
  const isNative = effectiveTier === "native";

  let upcomingBlock = "";
  let bookingsBlock = "";
  let nearTermAppointments: CaraNearTermAppointment[] = [];
  const salonTz = getSalonTimeZone();

  const callsYesterdayCount =
    callsYesterdayRes.error != null ? null : (callsYesterdayRes.count ?? 0);

  const rollingRows = await loadCaraRollingPerformanceWindows(supabase, organizationId, {
    nowIso,
    isNative,
  });
  const rollingPerformanceBlock = formatCaraRollingPerformanceBlock(
    rollingRows,
    isNative,
  );

  if (isNative) {
    const [upcomingRes, apptsYesterdayRes, bookingValueYesterday, nearTerm] =
      await Promise.all([
      supabase
        .from("appointments")
        .select("id, customer_name, start_time, status, services ( name )")
        .eq("organization_id", organizationId)
        .gt("start_time", nowIso)
        .eq("status", "confirmed")
        .order("start_time", { ascending: true })
        .limit(8),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "confirmed")
        .gte("start_time", yesterdayStartIso)
        .lt("start_time", yesterdayEndExclusiveIso),
      sumAppointmentBookingValueEur(supabase, {
        organizationId,
        rangeStartIso: yesterdayStartIso,
        rangeEndExclusiveIso: yesterdayEndExclusiveIso,
      }),
      loadCaraNearTermConfirmedAppointments(
        supabase,
        organizationId,
        salonTz,
      ),
    ]);
    nearTermAppointments = nearTerm;

    const upcoming = upcomingRes.error ? [] : (upcomingRes.data ?? []);
    if (upcoming.length === 0) {
      upcomingBlock = "Upcoming confirmed visits: none in the snapshot.";
    } else {
      upcomingBlock = upcoming
        .map((row: Record<string, unknown>) => {
          const name = String(row.customer_name ?? "Guest");
          const start = String(row.start_time ?? "");
          const svc = row.services as { name?: string } | { name?: string }[] | null;
          const svcName = Array.isArray(svc)
            ? svc[0]?.name
            : typeof svc === "object" && svc && "name" in svc
              ? String((svc as { name: string }).name)
              : "";
          return `- ${name}${svcName ? ` — ${svcName}` : ""} @ ${formatWhen(start)}`;
        })
        .join("\n");
    }

    const apptsYesterdayCount =
      apptsYesterdayRes.error != null ? null : (apptsYesterdayRes.count ?? 0);
    const row7 = rollingRows.find((r) => r.days === 7);
    const weekBooking =
      row7?.bookingValueCreatedEur != null
        ? formatBookingValueEur(row7.bookingValueCreatedEur)
        : "unknown";

    bookingsBlock = [
      `Approx. booking value (confirmed+completed **created** in last 7 days, from service prices): ${weekBooking}.`,
      `Yesterday (Dublin calendar): confirmed visits that **occurred** yesterday (by appointment start time): ${apptsYesterdayCount ?? "unknown"}.`,
      `Appointments **created** yesterday (by created_at), booking value from service prices: ${formatBookingValueEur(bookingValueYesterday)}.`,
    ].join("\n");
  } else {
    const fresha = org?.fresha_url?.trim();
    upcomingBlock =
      "This workspace is on Connect: day-to-day bookings usually live on your linked booking platform, not in Cliste appointments.";
    bookingsBlock = fresha && /^https?:\/\//i.test(fresha)
      ? `Booking platform link on file: ${fresha}`
      : "No booking platform URL on file in Cliste.";
  }

  const openTickets = ticketsRes.error ? [] : (ticketsRes.data ?? []);
  const ticketLines =
    openTickets.length === 0
      ? "Open action tickets: none."
      : `Open action tickets (${openTickets.length}):\n${openTickets
          .map(
            (t: { summary?: string; caller_number?: string; created_at?: string }) =>
              `- ${truncate(String(t.summary ?? ""), 160)} (caller ${String(t.caller_number ?? "?")}, ${formatWhen(String(t.created_at ?? ""))})`,
          )
          .join("\n")}`;

  const calls = callsRes.error ? [] : (callsRes.data ?? []);

  const yesterdayBlock = [
    "Yesterday snapshot (Europe/Dublin calendar day, for “how did we do yesterday” questions):",
    `- AI calls logged (call_logs.created_at in that window): ${callsYesterdayCount ?? "unknown"}.`,
    isNative
      ? "See also booking lines under “Approx. booking value” for visits that occurred yesterday and value from appointments created yesterday, and the rolling performance table for multi-week trends."
      : "Connect tier: appointment booking value / visit counts may live on your external booking platform; AI call counts still come from Cliste below.",
  ].join("\n");

  const nearTermLines =
    !isNative || nearTermAppointments.length === 0
      ? isNative
        ? `Upcoming diary (next ${CARA_APPOINTMENT_LOOKAHEAD_DAYS} days): no confirmed Cliste visits in this window.`
        : null
      : `Upcoming confirmed Cliste visits (next ${CARA_APPOINTMENT_LOOKAHEAD_DAYS} salon-calendar days — use for scheduling questions; do not mention internal database ids):\n${nearTermAppointments
          .map(
            (a) =>
              `- ${a.customer_name} @ ${formatWhen(a.start_time)} → ${formatWhen(a.end_time)}`,
          )
          .join("\n")}`;

  const callLines =
    calls.length === 0
      ? "Recent AI calls: none in snapshot."
      : `Recent AI calls (newest first, sample up to 30):\n${calls
          .map(
            (c: {
              outcome?: string;
              created_at?: string;
              ai_summary?: string | null;
              transcript_review?: string | null;
              transcript?: string | null;
              duration_seconds?: number;
            }) => {
              const note =
                (c.ai_summary && c.ai_summary.trim()) ||
                (c.transcript_review && c.transcript_review.trim()) ||
                (c.transcript && truncate(c.transcript.trim(), 220)) ||
                "(no summary)";
              return `- ${formatWhen(String(c.created_at ?? ""))} · outcome ${String(c.outcome ?? "?")} · ${Math.max(0, Number(c.duration_seconds ?? 0))}s · ${truncate(note, 260)}`;
            },
          )
          .join("\n")}`;

  const services = servicesRes.error ? [] : (servicesRes.data ?? []);
  const published = services.filter(
    (s: { is_published?: boolean }) => s.is_published !== false,
  );
  const publishedServices: CaraPublishedService[] = published
    .map((s: { id?: string; name?: string; duration_minutes?: number }) => ({
      id: String(s.id ?? ""),
      name: String(s.name ?? "?"),
      duration_minutes: Number(s.duration_minutes ?? 0),
    }))
    .filter((s) => s.id.length > 0);
  const serviceLines =
    published.length === 0
      ? "Published services on menu: none listed (or none published)."
      : `Published services (sample up to 40):\n${published
          .map(
            (s: { name?: string; price?: number; duration_minutes?: number }) =>
              `- ${String(s.name ?? "?")} — €${Number(s.price ?? 0)} — ${Number(s.duration_minutes ?? 0)} min`,
          )
          .join("\n")}`;

  const text = [
    userFirstName
      ? `Person chatting (from profile): ${userFirstName}`
      : "Person chatting: name not set on profile.",
    `Salon: ${salonName} (slug ${org?.slug ?? "?"})`,
    `Product mode: ${effectiveTier} (database tier: ${org?.tier ?? "?"})`,
    `Niche: ${org?.niche ?? "unknown"}`,
    org?.greeting?.trim()
      ? `Salon greeting on file: ${truncate(org.greeting.trim(), 200)}`
      : null,
    "",
    rollingPerformanceBlock,
    "",
    yesterdayBlock,
    "",
    bookingsBlock,
    "",
    nearTermLines,
    "",
    "Upcoming schedule (Cliste appointments):",
    upcomingBlock,
    "",
    ticketLines,
    "",
    callLines,
    "",
    serviceLines,
  ]
    .filter((x) => x !== null)
    .join("\n");

  return {
    text,
    salonName,
    userFirstName,
    isNative,
    nearTermAppointments,
    publishedServices,
  };
}
