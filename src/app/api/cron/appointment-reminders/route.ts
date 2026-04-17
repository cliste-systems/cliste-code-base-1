import { NextResponse } from "next/server";
import twilio from "twilio";

import { reminderSmsBody } from "@/lib/appointment-reminder-sms";
import {
  buildAppointmentReminderEmailBodies,
  normalizeOptionalCustomerEmail,
} from "@/lib/booking-transactional-email";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
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

type AppointmentEmailRow = AppointmentRow & {
  customer_email: string | null;
};

function embedName(
  row: { name: string } | { name: string }[] | null | undefined,
): string | undefined {
  if (!row) return undefined;
  const o = Array.isArray(row) ? row[0] : row;
  return o?.name;
}

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const candidate = bearer ?? header ?? "";
  if (!candidate) return false;
  return timingSafeEqualUtf8(candidate, secret);
}

export async function GET(request: Request) {
  return runReminders(request);
}

export async function POST(request: Request) {
  return runReminders(request);
}

async function runReminders(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const smsFrom =
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();
  const twilioReady = Boolean(sid && token && smsFrom);
  const sendgridReady = isSendGridConfigured();

  if (!twilioReady && !sendgridReady) {
    return NextResponse.json(
      {
        error:
          "Configure Twilio (SMS reminders) and/or SendGrid with SENDGRID_API_KEY + SENDGRID_FROM_EMAIL (email reminders).",
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

  const smsSent: string[] = [];
  const smsFailed: { id: string; message: string }[] = [];
  let smsMatched = 0;

  if (twilioReady) {
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
      console.error("appointment-reminders SMS query", qErr);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const list = (rows ?? []) as AppointmentRow[];
    smsMatched = list.length;
    const client = twilio(sid!, token!);

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
        await client.messages.create({ from: smsFrom!, to, body });
        const { error: upErr } = await supabase
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", row.id)
          .is("reminder_sent_at", null);
        if (upErr) {
          smsFailed.push({ id: row.id, message: upErr.message });
          continue;
        }
        smsSent.push(row.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Twilio reminder failed", row.id, message);
        smsFailed.push({ id: row.id, message });
      }
    }
  }

  const emailSent: string[] = [];
  const emailFailed: { id: string; message: string }[] = [];
  let emailMatched = 0;

  if (sendgridReady) {
    const { data: emailRows, error: emailQErr } = await supabase
      .from("appointments")
      .select(
        `
      id,
      customer_name,
      customer_phone,
      customer_email,
      start_time,
      booking_reference,
      organizations ( name ),
      services ( name )
    `,
      )
      .eq("status", "confirmed")
      .is("reminder_email_sent_at", null)
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd);

    if (emailQErr) {
      console.error("appointment-reminders email query", emailQErr);
      return NextResponse.json({ error: emailQErr.message }, { status: 500 });
    }

    const elist = (emailRows ?? []) as AppointmentEmailRow[];
    const withEmail = elist.filter((r) =>
      Boolean(normalizeOptionalCustomerEmail(r.customer_email)),
    );
    emailMatched = withEmail.length;

    for (const row of withEmail) {
      const to = normalizeOptionalCustomerEmail(row.customer_email)!;
      const salonName =
        embedName(row.organizations)?.trim() || "the salon";
      const serviceName =
        embedName(row.services)?.trim() || "your appointment";
      const bodies = buildAppointmentReminderEmailBodies({
        customerName: row.customer_name,
        salonName,
        serviceName,
        startTimeIso: row.start_time,
        bookingReference: row.booking_reference,
      });
      const res = await sendTransactionalEmail({
        to,
        subject: bodies.subject,
        text: bodies.text,
        html: bodies.html,
      });
      if (!res.ok) {
        emailFailed.push({ id: row.id, message: res.message });
        continue;
      }
      const { error: upErr } = await supabase
        .from("appointments")
        .update({ reminder_email_sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("reminder_email_sent_at", null);
      if (upErr) {
        emailFailed.push({ id: row.id, message: upErr.message });
        continue;
      }
      emailSent.push(row.id);
    }
  }

  return NextResponse.json({
    ok: true,
    window: { windowStart, windowEnd },
    sms: {
      enabled: twilioReady,
      matched: smsMatched,
      sent: smsSent.length,
      sentIds: smsSent,
      failed: smsFailed,
    },
    email: {
      enabled: sendgridReady,
      matched: emailMatched,
      sent: emailSent.length,
      sentIds: emailSent,
      failed: emailFailed,
    },
  });
}
