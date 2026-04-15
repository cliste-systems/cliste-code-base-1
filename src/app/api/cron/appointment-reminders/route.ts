import { NextResponse } from "next/server";
import twilio from "twilio";

import { reminderSmsBody } from "@/lib/appointment-reminder-sms";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AppointmentRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  booking_reference: string;
  organizations: { name: string } | { name: string }[] | null;
  services: { name: string } | { name: string }[] | null;
};

function embedName(
  row: { name: string } | { name: string }[] | null | undefined,
): string | undefined {
  if (!row) return undefined;
  const o = Array.isArray(row) ? row[0] : row;
  return o?.name;
}

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  return bearer === secret || header === secret;
}

export async function GET(request: Request) {
  return runReminders(request);
}

export async function POST(request: Request) {
  return runReminders(request);
}

async function runReminders(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from =
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!sid || !token || !from) {
    return NextResponse.json(
      {
        error:
          "Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM or TWILIO_PHONE_NUMBER)",
      },
      { status: 503 },
    );
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const now = Date.now();
  /** Appointments whose start is ~24h from now (hourly cron: 1h window). */
  const windowStart = new Date(now + 23.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 24.5 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: qErr } = await supabase
    .from("appointments")
    .select(
      `
      id,
      customer_name,
      customer_phone,
      start_time,
      booking_reference,
      organizations ( name ),
      services ( name )
    `,
    )
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_time", windowStart)
    .lte("start_time", windowEnd);

  if (qErr) {
    console.error("appointment-reminders query", qErr);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const list = (rows ?? []) as AppointmentRow[];
  const client = twilio(sid, token);
  const sent: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const row of list) {
    const salonName =
      embedName(row.organizations)?.trim() || "the salon";
    const serviceName =
      embedName(row.services)?.trim() || "your appointment";
    const body = reminderSmsBody({
      customerName: row.customer_name,
      salonName,
      serviceName,
      startTimeIso: row.start_time,
      bookingReference: row.booking_reference,
    });
    const to = row.customer_phone.trim();
    try {
      await client.messages.create({ from, to, body });
      const { error: upErr } = await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("reminder_sent_at", null);
      if (upErr) {
        failed.push({ id: row.id, message: upErr.message });
        continue;
      }
      sent.push(row.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Twilio reminder failed", row.id, message);
      failed.push({ id: row.id, message });
    }
  }

  return NextResponse.json({
    ok: true,
    window: { windowStart, windowEnd },
    matched: list.length,
    sent: sent.length,
    sentIds: sent,
    failed,
  });
}
