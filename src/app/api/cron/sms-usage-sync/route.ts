import { NextResponse } from "next/server";

import { syncSmsUsageToStripe } from "@/lib/sms-usage-sync";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function run(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncSmsUsageToStripe();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] sms-usage-sync", err);
    return NextResponse.json(
      { ok: false, error: "SMS usage sync failed." },
      { status: 500 },
    );
  }
}
