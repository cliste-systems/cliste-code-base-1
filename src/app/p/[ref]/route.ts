import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short pay-link redirector.
 *
 * Stripe Checkout URLs are ~140 chars, which on an SMS counts as *two*
 * segments and looks scary in a preview ("Message from a trusted contact"
 * with a long opaque host). We store the PI / session on the appointment
 * keyed by booking_reference, so /p/<ref> can look the URL up and 302 to
 * Stripe — turning a 140-char link into https://app.clistesystems.ie/p/L355DLUX
 * (~42 chars) that clearly belongs to the salon platform.
 *
 * Behaviour per payment_status:
 *   - 'pending' with a stripe_checkout_session_id → 302 to the session URL.
 *   - 'paid' → 302 to the public booking-success page (keeps receipts working
 *     when a customer taps an old SMS).
 *   - anything else → booking-success fallback so the URL never dead-ends.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  const bookingRef = (ref ?? "").trim().toUpperCase();

  if (!/^[A-Z0-9-]{4,32}$/.test(bookingRef)) {
    return new NextResponse("Invalid link", { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "booking_reference, payment_status, stripe_checkout_session_id, organization:organizations(slug)",
    )
    .eq("booking_reference", bookingRef)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("Booking not found", { status: 404 });
  }

  const org = Array.isArray(data.organization)
    ? data.organization[0]
    : data.organization;
  const slug = org?.slug ?? null;

  const sessionId = data.stripe_checkout_session_id;
  const status = data.payment_status;
  const successPath = slug
    ? `/${slug}/booking/success?ref=${encodeURIComponent(bookingRef)}`
    : `/booking/success?ref=${encodeURIComponent(bookingRef)}`;

  if (status === "pending" && sessionId) {
    // Resolve the Checkout URL from Stripe at request time so we never
    // hand out a stale URL if the session expired / was recreated.
    try {
      const { getStripeClient, stripeIsConfigured } = await import(
        "@/lib/stripe"
      );
      if (stripeIsConfigured()) {
        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.url) {
          return NextResponse.redirect(session.url, 302);
        }
      }
    } catch (err) {
      console.warn("[/p/:ref] could not resolve session", err);
    }
  }

  // Paid, or no session URL — send them to the success page so they at
  // least see their booking receipt instead of a 404.
  return NextResponse.redirect(new URL(successPath, _req.url), 302);
}
