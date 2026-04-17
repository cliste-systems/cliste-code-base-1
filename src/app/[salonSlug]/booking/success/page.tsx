import { CalendarClock, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { createAdminClient } from "@/utils/supabase/admin";

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
    .select("id, slug, name")
    .eq("slug", salonSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!org) notFound();

  const salonName = resolveOrganizationDisplayName(org.name ?? null, org.slug);

  // Fetch the held/paid appointment. We scope by organization_id so a crafted
  // `?ref=` can't leak data across salons.
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
        // supabase-js returns joined rows as arrays when the FK is ambiguous;
        // normalise to the shape we render.
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-gray-900">
      <StatusCard
        status={status}
        salonName={salonName}
        appointment={appointment}
      />
      <div className="mt-6 flex items-center gap-3 text-sm">
        <Link
          href={storefrontHref}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-50"
        >
          Back to {salonName}
        </Link>
      </div>
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

  const base =
    "w-full rounded-2xl border p-6 text-center shadow-sm sm:p-8";

  if (status === "paid") {
    return (
      <section className={`${base} border-emerald-200 bg-emerald-50/70`}>
        <CheckCircle2
          className="mx-auto h-12 w-12 text-emerald-600"
          aria-hidden
        />
        <h1 className="mt-3 text-xl font-semibold text-gray-900">
          You&rsquo;re booked in!
        </h1>
        <p className="mt-1 text-sm text-gray-700">
          Payment received — {salonName} will see you soon.
        </p>
        <BookingDetails
          startLabel={startLabel}
          amountLabel={amountLabel}
          serviceName={serviceName}
          reference={appointment?.booking_reference ?? null}
        />
      </section>
    );
  }

  if (status === "processing") {
    return (
      <section className={`${base} border-amber-200 bg-amber-50/70`}>
        <Loader2
          className="mx-auto h-12 w-12 animate-spin text-amber-600"
          aria-hidden
        />
        <h1 className="mt-3 text-xl font-semibold text-gray-900">
          Finalising your booking…
        </h1>
        <p className="mt-1 text-sm text-gray-700">
          Your payment is being confirmed by your bank. You&rsquo;ll get a text
          when it&rsquo;s finalised — you can safely close this page.
        </p>
        <BookingDetails
          startLabel={startLabel}
          amountLabel={amountLabel}
          serviceName={serviceName}
          reference={appointment?.booking_reference ?? null}
        />
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className={`${base} border-red-200 bg-red-50/70`}>
        <XCircle className="mx-auto h-12 w-12 text-red-600" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold text-gray-900">
          Payment didn&rsquo;t go through
        </h1>
        <p className="mt-1 text-sm text-gray-700">
          No worries — your card wasn&rsquo;t charged. Head back to{" "}
          {salonName} to try again.
        </p>
      </section>
    );
  }

  return (
    <section className={`${base} border-gray-200 bg-white`}>
      <Clock className="mx-auto h-12 w-12 text-gray-500" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-gray-900">
        We&rsquo;re checking on your booking
      </h1>
      <p className="mt-1 text-sm text-gray-700">
        Give us a moment. You&rsquo;ll get a text from {salonName} as soon as
        the booking is confirmed.
      </p>
    </section>
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
    <dl className="mt-5 grid gap-3 rounded-xl bg-white/70 p-4 text-left text-sm text-gray-800">
      <div className="flex items-start gap-3">
        <CalendarClock
          className="mt-0.5 h-4 w-4 flex-none text-gray-500"
          aria-hidden
        />
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            When
          </dt>
          <dd className="font-medium text-gray-900">
            {startLabel ?? "We&rsquo;ll confirm the time shortly"}
          </dd>
        </div>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-gray-500">
          Service
        </dt>
        <dd className="font-medium text-gray-900">{serviceName}</dd>
      </div>
      {amountLabel ? (
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Paid
          </dt>
          <dd className="font-medium text-gray-900">{amountLabel}</dd>
        </div>
      ) : null}
      {reference ? (
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Reference
          </dt>
          <dd className="font-mono text-gray-900">#{reference}</dd>
        </div>
      ) : null}
    </dl>
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
