import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { stripChatMarkdownDisplay } from "@/lib/cara-chat-display";
import {
  isCaraStorageUnavailableError,
  listMessagesAsc,
  rowsToClientPayload,
  touchConversation,
} from "@/lib/cara-chat-persistence";
import { sendAppointmentCancellationSms } from "@/lib/appointment-cancellation-sms";
import { sendAppointmentCancellationEmailBestEffort } from "@/lib/booking-transactional-email";
import { cancelConfirmedAppointmentForOrganization } from "@/lib/dashboard-appointment-cancel";
import { getOptionalDashboardSession } from "@/lib/dashboard-session";
import { fixedWindowHit } from "@/lib/fixed-window-rate-limit";

export const runtime = "nodejs";

type Body = { pendingActionId?: unknown; confirm?: unknown };

function parseBody(body: unknown): { pendingActionId: string; confirm: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Body;
  if (typeof o.pendingActionId !== "string" || !o.pendingActionId.trim()) return null;
  if (typeof o.confirm !== "boolean") return null;
  return { pendingActionId: o.pendingActionId.trim(), confirm: o.confirm };
}

export async function POST(request: Request) {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 60 confirms / cancels per minute is well above any human reasonable
  // pace and slows automated replay attacks against pending-action ids.
  const rl = fixedWindowHit({
    scope: "cara-pending-confirm",
    key: session.user.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Expected { pendingActionId: string, confirm: boolean }" },
      { status: 400 },
    );
  }

  const { pendingActionId, confirm } = parsed;

  const { data: row, error: loadErr } = await session.supabase
    .from("cara_pending_actions")
    .select(
      "id, conversation_id, organization_id, user_id, action_type, appointment_id, summary, expires_at",
    )
    .eq("id", pendingActionId)
    .maybeSingle();

  if (loadErr) {
    if (isCaraStorageUnavailableError(loadErr.message)) {
      return NextResponse.json(
        { error: "Chat actions are not available on this database yet." },
        { status: 503 },
      );
    }
    console.error("Cara pending load", loadErr);
    return NextResponse.json(
      { error: "Could not load that confirmation." },
      { status: 500 },
    );
  }

  if (!row) {
    return NextResponse.json(
      { error: "That confirmation request expired or was already handled." },
      { status: 404 },
    );
  }

  if (
    row.organization_id !== session.organizationId ||
    row.user_id !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await session.supabase.from("cara_pending_actions").delete().eq("id", pendingActionId);
    return NextResponse.json(
      { error: "That confirmation request expired. Ask Cara again if you still need it." },
      { status: 410 },
    );
  }

  const conversationId = String(row.conversation_id);

  if (!confirm) {
    await session.supabase.from("cara_pending_actions").delete().eq("id", pendingActionId);
    const dismissText = stripChatMarkdownDisplay(
      "No problem—I left your diary exactly as it was. Say if you want to try again with a clearer time or name.",
    );
    const { error: insErr } = await session.supabase.from("cara_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: dismissText,
    });
    if (insErr) {
      console.error("Cara dismiss message", insErr);
      return NextResponse.json(
        { error: "Dismissed the action but could not save a reply." },
        { status: 500 },
      );
    }
    await touchConversation(session.supabase, conversationId);
    const finalRows = await listMessagesAsc(session.supabase, conversationId);
    return NextResponse.json({
      conversationId,
      messages: rowsToClientPayload(finalRows),
    });
  }

  if (row.action_type !== "cancel_appointment") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const cancelResult = await cancelConfirmedAppointmentForOrganization(
    session.supabase,
    session.organizationId,
    String(row.appointment_id),
  );

  await session.supabase.from("cara_pending_actions").delete().eq("id", pendingActionId);

  let smsNote = "";
  if (
    cancelResult.ok &&
    cancelResult.didPerformCancellation &&
    row.appointment_id
  ) {
    const apptId = String(row.appointment_id);
    const sms = await sendAppointmentCancellationSms(
      session.supabase,
      session.organizationId,
      apptId,
    );
    if (sms.sent) {
      smsNote = " They’ve been sent a text to confirm it’s cancelled.";
    } else if (sms.reason === "no_phone" || sms.reason === "invalid_phone") {
      smsNote =
        " There wasn’t a valid mobile on the booking, so no cancellation text was sent.";
    } else {
      smsNote =
        " The automatic cancellation text didn’t go through — tell the client if they should know, or message Cliste Support.";
    }
    await sendAppointmentCancellationEmailBestEffort(
      session.supabase,
      session.organizationId,
      apptId,
    );
  }

  const outcomeText = stripChatMarkdownDisplay(
    cancelResult.ok
      ? `Done — I cancelled ${String(row.summary)}. It will disappear from Calendar and Bookings.${smsNote}`
      : `I couldn’t complete the cancellation: ${cancelResult.message}`,
  );

  const { error: insErr } = await session.supabase.from("cara_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: outcomeText,
  });
  if (insErr) {
    console.error("Cara outcome message", insErr);
    return NextResponse.json(
      { error: "The booking may have updated, but I could not save Cara’s reply." },
      { status: 500 },
    );
  }

  if (cancelResult.ok) {
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
  }

  await touchConversation(session.supabase, conversationId);
  const finalRows = await listMessagesAsc(session.supabase, conversationId);
  return NextResponse.json({
    conversationId,
    messages: rowsToClientPayload(finalRows),
  });
}
