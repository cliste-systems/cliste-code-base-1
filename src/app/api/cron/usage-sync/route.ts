import { NextResponse } from "next/server";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { syncUsageToStripe } from "@/lib/usage-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly cron: forwards finished `usage_records` rows to Stripe as
 * `cliste_call_minute` meter events.
 *
 * Scheduled via vercel.json. Idempotent — each usage_records row carries its
 * own Stripe meter-event identifier, so re-runs re-use it and Stripe drops
 * duplicates.
 */
async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const candidate = bearer ?? header ?? "";
  if (!candidate) return false;
  return timingSafeEqualUtf8(candidate, secret);
}

// Vercel cron invokes GET with `Authorization: Bearer ${CRON_SECRET}`. We
// never accept the secret in a query string so GET is safe.
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncUsageToStripe();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] usage-sync", err);
    return NextResponse.json(
      { ok: false, error: "Usage sync failed." },
      { status: 500 },
    );
  }
}
