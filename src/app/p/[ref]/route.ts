import { type NextRequest, NextResponse } from "next/server";

import { fixedWindowHit } from "@/lib/fixed-window-rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  // Prefer trusted-edge headers (Cloudflare, Vercel) over leftmost XFF, which
  // is client-controlled on platforms that don't sanitise it. Falls back to
  // the rightmost (closest-hop) XFF entry rather than the leftmost so a
  // forged "0.0.0.0" prefix can't share a bucket with everyone else.
  const fromCf = req.headers.get("cf-connecting-ip")?.trim();
  if (fromCf) return fromCf;
  const fromRealIp = req.headers.get("x-real-ip")?.trim();
  if (fromRealIp) return fromRealIp;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }
  return "0.0.0.0";
}

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

  // Defence in depth: this route hits the DB and (if pending) Stripe on
  // every call. Cap each source IP to 30 lookups per minute so a scanner
  // can't grind through booking references or DoS the Stripe API.
  const ipLimit = fixedWindowHit({
    scope: "p-ref-ip",
    key: clientIp(_req),
    limit: 30,
    windowMs: 60_000,
  });
  if (!ipLimit.allowed) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "retry-after": String(ipLimit.retryAfterSec) },
    });
  }
  // And cap *per booking reference* — even if attackers rotate IPs, a
  // single ref shouldn't be hit more than a handful of times in a window
  // (legit users tap the SMS link once or twice).
  const refLimit = fixedWindowHit({
    scope: "p-ref-ref",
    key: bookingRef,
    limit: 10,
    windowMs: 60_000,
  });
  if (!refLimit.allowed) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "retry-after": String(refLimit.retryAfterSec) },
    });
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
    // Don't expose booking existence to unauthenticated callers — return the
    // same generic redirect a paid/legacy ref would. This avoids turning the
    // route into a "does ref X exist?" oracle for ref enumeration.
    return NextResponse.redirect(
      new URL(`/booking/success?ref=${encodeURIComponent(bookingRef)}`, _req.url),
      302,
    );
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
