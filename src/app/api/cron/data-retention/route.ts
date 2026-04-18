import { NextResponse } from "next/server";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily GDPR retention sweep. Implements the schedule documented in
 * `/legal/privacy` — voice transcripts are nulled after 30 days, AI
 * summaries after 13 months, OTP rows after 30 minutes, anti-abuse rate
 * events after 14 days, and security audit logs after 2 years.
 *
 * Each step is idempotent — re-running on the same day is a no-op.
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual
 * runs use POST with the same header.
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

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

type SweepResult = {
  step: string;
  affected: number;
  error?: string;
};

async function run(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  // Each step uses `select("id")` so PostgREST returns affected rows.
  // We don't fail the whole sweep if one step errors — best-effort.
  const steps: SweepResult[] = [];

  async function step(
    name: string,
    fn: () => Promise<{ count: number; error?: string }>,
  ) {
    try {
      const r = await fn();
      steps.push({ step: name, affected: r.count, ...(r.error ? { error: r.error } : {}) });
    } catch (e) {
      steps.push({
        step: name,
        affected: 0,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // ---------------------------------------------------------------------
  // 1. Call transcripts: 30 days. Null out the verbose blob; keep the
  //    `ai_summary`, `outcome`, `duration_seconds`, `caller_number` for
  //    operational reporting (caller_number is needed for repeat-caller
  //    detection on the action inbox).
  // ---------------------------------------------------------------------
  await step("call_logs.transcript", async () => {
    const cutoff = iso(30 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("call_logs")
      .update({ transcript: null, transcript_review: null })
      .lt("created_at", cutoff)
      .not("transcript", "is", null)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  // ---------------------------------------------------------------------
  // 2. AI summaries: 13 months. Useful for year-on-year reporting; not
  //    needed indefinitely. Caller phone is also nulled at this point so
  //    the row becomes effectively anonymous.
  // ---------------------------------------------------------------------
  await step("call_logs.ai_summary", async () => {
    const cutoff = iso(395 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("call_logs")
      .update({ ai_summary: null, caller_number: null })
      .lt("created_at", cutoff)
      .or("ai_summary.not.is.null,caller_number.not.is.null")
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  // ---------------------------------------------------------------------
  // 3. OTP challenges: 30 minutes. Codes already expire — we just need
  //    to clear the row so it stops contributing to rate-limit counters
  //    and PII storage.
  // ---------------------------------------------------------------------
  await step("public_booking_otp_challenges", async () => {
    const cutoff = iso(30 * 60 * 1000);
    const { data, error } = await admin
      .from("public_booking_otp_challenges")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  // ---------------------------------------------------------------------
  // 4. Anti-abuse rate events: 14 days. Past that we don't need the
  //    row to enforce limits, and it's just a phone-number log.
  // ---------------------------------------------------------------------
  await step("public_booking_rate_events", async () => {
    const cutoff = iso(14 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("public_booking_rate_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  // ---------------------------------------------------------------------
  // 5. Security audit log: 2 years.
  //    We keep these long because they're valuable for incident
  //    investigation, but Article 5(e) requires we don't keep forever.
  // ---------------------------------------------------------------------
  await step("security_auth_events", async () => {
    const cutoff = iso(730 * 24 * 60 * 60 * 1000);
    const { data, error } = await admin
      .from("security_auth_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return { count: data?.length ?? 0, error: error?.message };
  });

  return NextResponse.json({
    ok: true,
    runAt: new Date(now).toISOString(),
    steps,
  });
}
