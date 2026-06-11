import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { notifyActionInboxOwner } from "@/lib/action-inbox-notify";
import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { redactCallText } from "@/lib/transcript-redaction";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type ActionTicketBody = {
  called_number?: string;
  caller_number: string;
  caller_name?: string | null;
  summary: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function authorize(request: Request): Promise<"ok" | "no_secret" | "bad"> {
  const secret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim();
  if (!secret) return "no_secret";
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cliste-voice-secret");
  const token = bearer ?? header ?? "";
  return (await timingSafeEqualUtf8(token, secret)) ? "ok" : "bad";
}

/**
 * Voice worker: create an Action Inbox ticket and notify the business owner.
 * Prefer this over writing `action_tickets` directly so notifications always fire.
 */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth === "no_secret") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Set CLISTE_VOICE_WEBHOOK_SECRET in .env.local (same value in your voice worker).",
      },
      { status: 503 },
    );
  }
  if (auth === "bad") return unauthorized();

  let body: ActionTicketBody;
  try {
    body = (await request.json()) as ActionTicketBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const callerNumber = String(body.caller_number ?? "").trim();
  if (!callerNumber) {
    return NextResponse.json(
      { ok: false, error: "caller_number is required" },
      { status: 400 },
    );
  }

  const summaryRaw = String(body.summary ?? "").trim();
  if (!summaryRaw) {
    return NextResponse.json(
      { ok: false, error: "summary is required" },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/action-ticket] phone lookup", phoneErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!phoneRow?.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: `called_number ${calledE164} is not assigned to any organization`,
      },
      { status: 404 },
    );
  }

  const orgId = phoneRow.organization_id as string;
  const summaryRedacted = redactCallText(summaryRaw);
  const callerName =
    String(body.caller_name ?? "").trim().slice(0, 120) || null;

  const { data: inserted, error: insertErr } = await admin
    .from("action_tickets")
    .insert({
      organization_id: orgId,
      caller_number: callerNumber,
      caller_name: callerName,
      summary: summaryRedacted.text ?? summaryRaw,
      status: "open",
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    console.error("[voice/action-ticket] insert", insertErr);
    return NextResponse.json(
      { ok: false, error: "Failed to create action ticket" },
      { status: 500 },
    );
  }

  try {
    await notifyActionInboxOwner(admin, orgId, {
      summary: summaryRedacted.text ?? summaryRaw,
      callerNumber,
      callerName,
    });
  } catch (e) {
    console.error("[voice/action-ticket] notify failed", e);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/action-inbox");

  return NextResponse.json({ ok: true, action_ticket_id: inserted.id });
}
