"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { buildSecurityEventContext, logSecurityEvent } from "@/lib/security-events";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Resolve an absolute origin for Connect redirect URLs. Prefers the configured
 * `NEXT_PUBLIC_APP_URL`; falls back to the incoming request host so local dev
 * (`localhost:3000`) works with Stripe sandbox.
 */
async function resolveReturnOrigin(): Promise<string> {
  const configured = resolveAppSiteOrigin();
  if (configured) return configured.origin;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

/**
 * Start (or resume) Stripe Connect Express onboarding for the salon attached
 * to the current dashboard session. Creates an Express account if missing and
 * returns an Account Link that we immediately redirect the operator to.
 */
export async function startStripeConnectOnboarding(): Promise<never> {
  const { supabase, organizationId } = await requireDashboardSession();
  const stripe = getStripeClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, stripe_account_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new Error("No organisation on this session.");

  let accountId = org.stripe_account_id?.trim() || null;

  if (!accountId) {
    const created = await stripe.accounts.create({
      type: "express",
      country: "IE",
      default_currency: "eur",
      business_profile: {
        name: org.name ?? undefined,
        product_description:
          "Salon bookings accepted via Cliste Systems (https://clistesystems.ie).",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { cliste_organization_id: organizationId },
    });
    accountId = created.id;

    // Service role write: the operator's RLS policy may not allow writing
    // these columns on `organizations`. This function already proved they
    // have operator access via `requireDashboardSession`.
    const admin = createAdminClient();
    const { error: updErr } = await admin
      .from("organizations")
      .update({ stripe_account_id: accountId })
      .eq("id", organizationId);
    if (updErr) throw new Error(updErr.message);
  }

  const origin = await resolveReturnOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/dashboard/payments?refresh=1`,
    return_url: `${origin}/dashboard/payments?status=return`,
  });

  // Fire-and-forget revalidation (we're about to redirect off-site anyway).
  revalidatePath("/dashboard/payments");
  redirect(link.url);
}

/**
 * Fetch the latest account capabilities from Stripe and persist them. Call on
 * dashboard page load when `?status=return` is present so the UI updates
 * immediately even if the webhook hasn't landed yet.
 */
export async function syncStripeConnectStatus(): Promise<void> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, stripe_account_id, stripe_onboarded_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org?.stripe_account_id) return;

  const stripe = getStripeClient();
  const acct = await stripe.accounts.retrieve(org.stripe_account_id);
  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);

  const admin = createAdminClient();
  const shouldSetOnboardedAt =
    chargesEnabled && detailsSubmitted && !org.stripe_onboarded_at;
  await admin
    .from("organizations")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
      ...(shouldSetOnboardedAt
        ? { stripe_onboarded_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", organizationId);

  revalidatePath("/dashboard/payments");
}

export type RefundAppointmentResult =
  | { ok: true; refundedCents: number; currency: string }
  | { ok: false; message: string };

/**
 * Full refund for a paid appointment. Uses `reverse_transfer` + `refund_application_fee`
 * so the salon's connected account *and* Cliste's platform fee are refunded
 * proportionally — the customer gets their money back in one hit.
 *
 * Security posture:
 * - `requireDashboardSession` enforces the caller is an authenticated operator.
 * - We re-scope the appointment lookup by `organization_id` from the session,
 *   so a crafted `appointmentId` belonging to another salon cannot be refunded.
 * - The refund is created on the platform Stripe account using our server-side
 *   secret key only; the client is never trusted with amounts.
 * - The DB row is flipped optimistically; the webhook confirms the refund
 *   landed (authoritative state).
 */
export async function refundAppointmentPayment(
  appointmentId: string,
): Promise<RefundAppointmentResult> {
  const id = appointmentId?.trim();
  if (!id) return { ok: false, message: "Missing appointment id." };

  const { supabase, organizationId } = await requireDashboardSession();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      "id, organization_id, payment_status, amount_cents, currency, stripe_payment_intent_id",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!appt) return { ok: false, message: "Appointment not found." };
  if (!appt.stripe_payment_intent_id) {
    return {
      ok: false,
      message: "No Stripe charge on this booking to refund.",
    };
  }
  if (appt.payment_status !== "paid") {
    return {
      ok: false,
      message:
        appt.payment_status === "refunded"
          ? "Already refunded."
          : "Only paid bookings can be refunded.",
    };
  }

  try {
    const stripe = getStripeClient();
    const admin = createAdminClient();
    // Atomic claim BEFORE calling Stripe — guarantees only one operator
    // click wins when the button is double-tapped. If another request
    // already flipped the row, `eq("payment_status","paid")` returns zero
    // rows and we abort before hitting Stripe.
    const claim = await admin
      .from("appointments")
      .update({ payment_status: "refunded" })
      .eq("id", appt.id)
      .eq("organization_id", organizationId)
      .eq("payment_status", "paid")
      .select("id");
    if (claim.error) {
      return { ok: false, message: "Could not start refund." };
    }
    if (!claim.data || claim.data.length === 0) {
      return {
        ok: false,
        message: "Refund already in progress or completed.",
      };
    }
    let refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: appt.stripe_payment_intent_id,
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: {
            appointment_id: appt.id,
            organization_id: appt.organization_id,
          },
        },
        {
          // Deterministic key keyed by appointment id — Stripe rejects a
          // second call with the same key + different params, and silently
          // returns the original refund object on the same key + same
          // params. Safe retries on network blips / Vercel timeouts.
          idempotencyKey: `refund-appointment-${appt.id}`,
        },
      );
    } catch (stripeErr) {
      // Roll the DB row back to `paid` so the operator can retry — the
      // refund didn't actually happen on Stripe's side.
      await admin
        .from("appointments")
        .update({ payment_status: "paid" })
        .eq("id", appt.id)
        .eq("organization_id", organizationId)
        .eq("payment_status", "refunded");
      throw stripeErr;
    }

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/bookings");

    // Audit trail — refunds are money-moving and must be reconstructable
    // long after the operator has logged out / left the company.
    try {
      const ctx = buildSecurityEventContext(await headers());
      await logSecurityEvent(ctx, {
        eventType: "appointment_refund_issued",
        outcome: "success",
        metadata: {
          appointment_id: appt.id,
          organization_id: appt.organization_id,
          stripe_refund_id: refund.id,
          amount_cents: refund.amount ?? appt.amount_cents ?? 0,
          currency: (refund.currency ?? appt.currency ?? "eur").toLowerCase(),
        },
      });
    } catch (logErr) {
      console.warn("[refund] failed to log security event", logErr);
    }

    return {
      ok: true,
      refundedCents: refund.amount ?? appt.amount_cents ?? 0,
      currency: (refund.currency ?? appt.currency ?? "eur").toLowerCase(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed.";
    console.error("refundAppointmentPayment failed", err);
    return { ok: false, message };
  }
}

/**
 * Returns a signed Stripe Express dashboard login link for the connected
 * account so the operator can manage payouts / payments directly on Stripe.
 */
export async function openStripeExpressDashboard(): Promise<never> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_account_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org?.stripe_account_id) {
    throw new Error("Connect Stripe first.");
  }
  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(org.stripe_account_id);
  redirect(link.url);
}

/**
 * Pull the live status of every still-pending PaymentIntent for the salon
 * from Stripe and flip our DB row if it has actually settled. Used both
 * automatically on Payments page load (best-effort, swallow errors) and via
 * a manual "Sync with Stripe" button if the operator wants to double-check.
 */
export async function syncPendingPayments(): Promise<{
  checked: number;
  flippedToPaid: number;
  flippedToFailed: number;
}> {
  const { organizationId } = await requireDashboardSession();
  const { reconcilePendingAppointmentPayments } = await import(
    "@/lib/booking-payment-reconcile"
  );
  const result = await reconcilePendingAppointmentPayments({
    organizationId,
  });
  if (result.flippedToPaid > 0 || result.flippedToFailed > 0) {
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/calendar");
  }
  return result;
}
