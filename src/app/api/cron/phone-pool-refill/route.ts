import { NextResponse } from "next/server";

import { refillPoolIfLow, poolHealthCheck } from "@/lib/phone-pool";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly pool top-up. Scheduled in vercel.json. The job is intentionally
 * idempotent and safe to call multiple times in a row — it only purchases
 * when the pool is below the low-water mark.
 *
 * Protect with CRON_SECRET (Bearer header or x-cron-secret).
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
    const before = await poolHealthCheck();
    const result = await refillPoolIfLow();
    const after = await poolHealthCheck();
    return NextResponse.json({
      ok: true,
      before,
      after,
      promoted: result.promoted,
      purchased: result.purchased,
      skippedReason: result.skippedReason ?? null,
    });
  } catch (err) {
    console.error("[cron] phone-pool-refill", err);
    // Generic message — avoid surfacing Twilio / Supabase error text to a
    // public endpoint (it's behind CRON_SECRET, but defence in depth).
    return NextResponse.json(
      { ok: false, error: "Pool refill failed." },
      { status: 500 },
    );
  }
}
