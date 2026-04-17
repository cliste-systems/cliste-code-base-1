import { CalendarClock, Check, Loader2, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { createAdminClient } from "@/utils/supabase/admin";

import { BookingStatusAutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ salonSlug: string }>;
  /**
   * Stripe appends `payment_intent`, `payment_intent_client_secret` and
   * `redirect_status` after a 3-D Secure redirect. We also pass `?ref=` so we
   * can always locate the appointment even when no redirect happened.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { salonSlug } = await params;
  const qs = await searchParams;
  const ref = firstParam(qs.ref);
  const redirectStatus = firstParam(qs.redirect_status);

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, logo_url")
    .eq("slug", salonSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!org) notFound();

  const salonName = resolveOrganizationDisplayName(org.name ?? null, org.slug);
  const logoUrl: string | null = (org as { logo_url?: string | null })
    .logo_url ?? null;

  // Fetch the held/paid appointment. We scope by organization_id so a crafted
  // `?ref=` cannot leak data across salons.
  let appointment: {
    id: string;
    start_time: string;
    payment_status: string | null;
    amount_cents: number | null;
    currency: string | null;
    booking_reference: string | null;
    service: { name: string | null } | null;
  } | null = null;

  if (ref) {
    const { data } = await admin
      .from("appointments")
      .select(
        "id, start_time, payment_status, amount_cents, currency, booking_reference, service:services(name)",
      )
      .eq("organization_id", org.id)
      .eq("booking_reference", ref)
      .maybeSingle();
    if (data) {
      appointment = {
        id: data.id,
        start_time: data.start_time,
        payment_status: data.payment_status ?? null,
        amount_cents: data.amount_cents ?? null,
        currency: data.currency ?? null,
        booking_reference: data.booking_reference ?? null,
        service: Array.isArray(data.service)
          ? (data.service[0] as { name: string | null } | undefined) ?? null
          : (data.service as { name: string | null } | null) ?? null,
      };
    }
  }

  const status: DisplayStatus = deriveDisplayStatus({
    redirectStatus,
    paymentStatus: appointment?.payment_status ?? null,
  });

  const storefrontHref = `/${org.slug}`;
  const isPending = status === "processing" || status === "unknown";

  return (
    <main className="min-h-[100dvh] bg-gray-50 text-gray-900">
      {/* Brand header bar — matches the booking storefront */}
      <header className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <SalonLogoBadge name={salonName} logoUrl={logoUrl} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-gray-900">
              {salonName}
            </div>
            <div className="truncate text-[11px] uppercase tracking-wide text-gray-500">
              Booking
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-col items-stretch px-4 py-10 sm:py-14">
        <StatusCard
          status={status}
          salonName={salonName}
          appointment={appointment}
        />

        <div className="mt-6 flex items-center justify-center">
          <Link
            href={storefrontHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50"
          >
            Back to {salonName}
          </Link>
        </div>
      </section>

      {isPending ? <BookingStatusAutoRefresh /> : null}
    </main>
  );
}

type DisplayStatus = "paid" | "processing" | "failed" | "unknown";

function deriveDisplayStatus(args: {
  redirectStatus: string | null;
  paymentStatus: string | null;
}): DisplayStatus {
  // Trust the DB first (it was updated via webhook-verified signature) and
  // fall back to the URL-borne Stripe status for the brief window before the
  // webhook lands.
  if (args.paymentStatus === "paid") return "paid";
  if (args.paymentStatus === "refunded") return "paid";
  if (args.paymentStatus === "failed") return "failed";
  if (args.redirectStatus === "succeeded") return "processing";
  if (args.redirectStatus === "processing") return "processing";
  if (args.redirectStatus === "requires_payment_method") return "failed";
  if (args.redirectStatus === "failed") return "failed";
  if (args.paymentStatus === "pending") return "processing";
  return "unknown";
}

function StatusCard({
  status,
  salonName,
  appointment,
}: {
  status: DisplayStatus;
  salonName: string;
  appointment: {
    start_time: string;
    amount_cents: number | null;
    currency: string | null;
    booking_reference: string | null;
    service: { name: string | null } | null;
  } | null;
}) {
  const startLabel = appointment?.start_time
    ? new Date(appointment.start_time).toLocaleString("en-IE", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : null;

  const amountLabel =
    appointment?.amount_cents != null && appointment?.currency
      ? formatMoney(appointment.amount_cents, appointment.currency)
      : null;

  const serviceName = appointment?.service?.name ?? "your appointment";

  const meta = STATUS_META[status];

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center sm:px-8">
        <StatusIcon status={status} />
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {meta.title}
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-gray-600">
          {meta.copy(salonName)}
        </p>
      </div>

      {appointment ? (
        <div className="border-t border-gray-100 px-6 pb-6 pt-5 sm:px-8">
          <BookingDetails
            startLabel={startLabel}
            amountLabel={amountLabel}
            serviceName={serviceName}
            reference={appointment.booking_reference ?? null}
          />
        </div>
      ) : null}
    </article>
  );
}

const STATUS_META: Record<
  DisplayStatus,
  { title: string; copy: (salonName: string) => string }
> = {
  paid: {
    title: "You're booked in",
    copy: (salonName) =>
      `Payment received — we've sent your confirmation by text. ${salonName} will see you soon.`,
  },
  processing: {
    title: "Confirming your booking",
    copy: () =>
      "Your bank is finalising the payment. We'll text you the moment it clears — you can close this page if you like.",
  },
  failed: {
    title: "Payment didn't go through",
    copy: (salonName) =>
      `Your card wasn't charged. Head back to ${salonName} to try again.`,
  },
  unknown: {
    title: "Just a moment",
    copy: (salonName) =>
      `Checking on your booking. You'll get a text from ${salonName} as soon as it's confirmed.`,
  },
};

function StatusIcon({ status }: { status: DisplayStatus }) {
  if (status === "paid") {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm">
        <Check className="h-6 w-6" aria-hidden />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-900 bg-white text-gray-900 shadow-sm">
        <X className="h-6 w-6" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-900 ring-1 ring-gray-200">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
    </span>
  );
}

function BookingDetails({
  startLabel,
  amountLabel,
  serviceName,
  reference,
}: {
  startLabel: string | null;
  amountLabel: string | null;
  serviceName: string;
  reference: string | null;
}) {
  return (
    <dl className="grid gap-3 text-left text-sm text-gray-800">
      <div className="flex items-start gap-3">
        <CalendarClock
          className="mt-0.5 h-4 w-4 flex-none text-gray-500"
          aria-hidden
        />
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            When
          </dt>
          <dd className="font-medium text-gray-900">
            {startLabel ?? "We'll confirm the time shortly"}
          </dd>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Service
          </dt>
          <dd className="mt-0.5 font-medium text-gray-900">{serviceName}</dd>
        </div>
        {amountLabel ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">
              Paid
            </dt>
            <dd className="mt-0.5 font-medium text-gray-900">{amountLabel}</dd>
          </div>
        ) : null}
        {reference ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">
              Reference
            </dt>
            <dd className="mt-0.5 font-mono text-gray-900">#{reference}</dd>
          </div>
        ) : null}
      </div>
    </dl>
  );
}

function SalonLogoBadge({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const trimmed = logoUrl?.trim() ?? "";
  const hasValid =
    trimmed && (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed));

  if (hasValid) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={trimmed}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-gray-200"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-medium tracking-wide text-white shadow-sm ring-1 ring-gray-900/10">
      {initials}
    </div>
  );
}

function firstParam(v: string | string[] | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
