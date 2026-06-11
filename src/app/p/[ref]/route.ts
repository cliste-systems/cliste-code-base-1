import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * v1: short pay-link redirector is retired (Cliste no longer takes customer
 * payments in the product). The route is kept so old SMS links don't hard-fail,
 * but it returns a neutral 404 for every reference — which also removes the
 * booking-reference enumeration surface. The previous Stripe-resolving
 * implementation is in git history; payment tables/columns are untouched.
 */
export async function GET(): Promise<NextResponse> {
  return new NextResponse("This link is no longer available.", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}
