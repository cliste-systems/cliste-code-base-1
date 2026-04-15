import { NextResponse } from "next/server";

import { getSalonTimeZone } from "@/lib/booking-available-slots";
import { resolveCancelAppointmentIntent } from "@/lib/cara-cancel-intent";
import {
  ensureActiveConversationId,
  isCaraStorageUnavailableError,
  listMessagesAsc,
  maybeSetConversationTitleFromUserMessage,
  rowsToClientPayload,
  sliceForOpenAi,
  touchConversation,
  verifyConversationAccess,
} from "@/lib/cara-chat-persistence";
import { stripChatMarkdownDisplay } from "@/lib/cara-chat-display";
import {
  buildCaraBookingUserContextBlobFromRows,
  tryCaraBookingFromMessage,
} from "@/lib/cara-booking-intent";
import { buildCaraSalonSnapshot } from "@/lib/cara-salon-context";
import { createDashboardAppointment } from "@/lib/dashboard-appointment-create";
import { refreshConversationTopicTitleAfterReply } from "@/lib/cara-conversation-topic";
import { getOptionalDashboardSession } from "@/lib/dashboard-session";

export const runtime = "nodejs";

const MAX_USER_CONTENT = 12_000;

function sanitizeAssistantText(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```[a-z0-9_-]*\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return stripChatMarkdownDisplay(t);
}

function noAiConfiguredReply(snapshot: { salonName: string }): string {
  return (
    `I’m here and I’ve peeked at ${snapshot.salonName}’s Cliste snapshot, but no LLM key is configured on this server yet (set OPENROUTER_API_KEY for OpenRouter, or OPENAI_API_KEY for OpenAI). ` +
    `Once that’s in place, I can talk things through using your live calls, tickets, and schedule. ` +
    `In the meantime, Calendar, Bookings, and Call History have the raw detail you need.`
  );
}

type ChatCompletionBackend =
  | {
      kind: "openrouter";
      apiKey: string;
      url: string;
      model: string;
    }
  | {
      kind: "openai";
      apiKey: string;
      url: string;
      model: string;
    };

function pickChatCompletionBackend(): ChatCompletionBackend | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      kind: "openrouter",
      apiKey: openRouterKey,
      url:
        process.env.OPENROUTER_API_BASE?.trim() ||
        "https://openrouter.ai/api/v1/chat/completions",
      model:
        process.env.CARA_OPENROUTER_MODEL?.trim() ||
        "google/gemini-2.5-flash-lite",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      kind: "openai",
      apiKey: openAiKey,
      url: "https://api.openai.com/v1/chat/completions",
      model: process.env.CARA_OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return null;
}

function parseBody(body: unknown): { content: string; conversationId: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as { content?: unknown; conversationId?: unknown };
  if (typeof o.content !== "string") return null;
  const content = o.content.trim();
  if (!content || content.length > MAX_USER_CONTENT) return null;
  const conversationId =
    typeof o.conversationId === "string" && o.conversationId.trim()
      ? o.conversationId.trim()
      : null;
  return { content, conversationId };
}

async function generateAssistantReply(
  turns: { role: "user" | "assistant"; content: string }[],
  snapshotText: string,
  salonName: string,
): Promise<{ text: string; model: string | null }> {
  const backend = pickChatCompletionBackend();
  if (!backend) {
    return { text: noAiConfiguredReply({ salonName }), model: null };
  }

  const system = [
    "You are Cara, the AI salon co-manager inside the Cliste dashboard.",
    "Speak in natural, warm, concise prose—like a trusted senior manager advising the owner.",
    "",
    "GUARDRAILS — scope (stay on the business):",
    "Only help with this salon’s operations, Cliste, and normal commercial salon/hospitality context tied to running the business (calls, bookings, diary, team, services, clients, storefront, metrics, follow-ups).",
    "If the user asks about unrelated topics (e.g. sports scores, politics, general trivia, celebrities, homework, unrelated coding, entertainment chit-chat), politely decline in one short sentence and offer something useful from the salon snapshot or dashboard instead—do not answer the off-topic part.",
    "Do not give medical diagnoses, legal advice, tax/financial advice, or mental-health counselling; you may give practical salon-business suggestions and say when a licensed professional should be consulted.",
    "Never encourage illegal activity, violence, self-harm, hate, harassment, or bypassing security. Do not ask for or repeat secrets (passwords, API keys, full payment card numbers). Treat staff and clients respectfully.",
    "Do not fabricate numbers, policies, or integrations that are not implied by the snapshot or obvious Cliste product behaviour.",
    "",
    "Cliste operates SMS, reminders, voice, and related integrations for salons—the owner does not configure SMS gateways, telecom providers, or platform API keys for those channels.",
    "If a text, reminder, OTP, or call flow failed or “did not send”, do not tell them to check or fix their own SMS gateway, Twilio, or provider settings. Briefly acknowledge the issue and tell them to open Dashboard → Support and message the Cliste team so we can investigate.",
    "",
    "Never output JSON, YAML, SQL, stack traces, HTML, or fenced code blocks. Do not paste raw database rows or pretend you ran code.",
    "Use only facts from the SALON SNAPSHOT below. If something is not there, say you do not see it in Cliste yet and point them to the right screen (Calendar, Bookings, Call History, Action Inbox, Clients, Services).",
    "Do not claim you “cannot access historical data” or that you only see a timeless “current snapshot” when the snapshot includes the rolling performance table (7–90 day rows), Dublin yesterday, 7-day booking value, or recent calls. Those numbers are the historical answer for this turn—summarise them in plain language.",
    "When the snapshot includes “Yesterday snapshot” (Europe/Dublin calendar day) and related booking lines, use those numbers to answer “how did we do yesterday” style questions—briefly distinguish AI calls logged that day vs confirmed visits that occurred that day vs booking value from appointments created that day.",
    "For “last N weeks” or “last N days”, pick the rolling row where N×7 days (weeks) or N days matches exactly if present (e.g. 3 weeks → 21d row, 2 weeks → 14d). If they ask for a span longer than 90 days, use the 90d row and say Cliste only summarised the last ~90 days in this view; they can still open Call History / Bookings for detail.",
    "You may refer to earlier messages in this thread when the user follows up or asks for a recap.",
    "Never say you cancelled, rescheduled, or changed a booking yourself—those changes only happen after the owner confirms in the Cara panel when offered.",
    "Never tell the owner a visit was saved in Bookings, that an SMS went out, or that a slot is confirmed unless they just saw the app do it in this same turn (you will not be told explicitly—so default to “I can help you phrase it” and point them to Bookings unless they confirm the UI updated). Do not narrate fake Twilio sends.",
    "On native Cliste (not Connect), when the user clearly gives a new booking in one message—client name, Irish mobile, a service name that matches the published menu in the snapshot, and a day+time like “1pm Monday” or “tomorrow 10am”—the system may already save it before you reply; if they say it worked, agree briefly. If they are vague, on Connect tier, or something failed, help them finish in Dashboard → Bookings.",
    "When gathering missing booking fields, ask once for: client name, mobile (08… or +353… for SMS), exact service name from the menu, and day+time. Say the mobile is needed for the confirmation text if they skipped it.",
    "Write in plain sentences only—do not use Markdown (no bold or italic markup, no heading hashes).",
    "When “Today and tomorrow” confirmed visits are listed, use them for diary questions (do not invent visits).",
    "Prefer short paragraphs and bullets only when it genuinely helps readability. Aim under ~200 words unless the user asks to go deeper.",
    "",
    "SALON SNAPSHOT (internal — do not read this aloud as a list to the user unless they ask for a recap):",
    snapshotText,
  ].join("\n");

  const openaiMessages = [
    { role: "system" as const, content: system },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${backend.apiKey}`,
  };

  if (backend.kind === "openrouter") {
    const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
    if (referer) {
      headers["HTTP-Referer"] = referer;
    }
    headers["X-Title"] =
      process.env.OPENROUTER_APP_TITLE?.trim() || "Cliste Cara";
  }

  const res = await fetch(backend.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: backend.model,
      temperature: 0.55,
      max_tokens: 1024,
      messages: openaiMessages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(
      `Cara LLM error (${backend.kind})`,
      res.status,
      errText.slice(0, 500),
    );
    return {
      text:
        "I hit a snag talking to the AI service just now. Your salon data is still fine—try again in a moment, or check Call History and Bookings while I’m unavailable.",
      model: null,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw =
    data.choices?.[0]?.message?.content?.trim() ||
    "I didn’t get a usable reply back—could you ask that again in one sentence?";

  return { text: sanitizeAssistantText(raw), model: backend.model };
}

export async function POST(request: Request) {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { error: "Expected { content: string, conversationId?: string }" },
      { status: 400 },
    );
  }

  const { content, conversationId: requestedId } = parsed;

  let conversationId: string;
  if (requestedId) {
    const ok = await verifyConversationAccess(
      session.supabase,
      requestedId,
      session.organizationId,
      session.user.id,
    );
    if (!ok) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    conversationId = requestedId;
  } else {
    conversationId = await ensureActiveConversationId(
      session.supabase,
      session.organizationId,
      session.user.id,
    );
  }

  const { error: insertUserErr } = await session.supabase
    .from("cara_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content,
    });

  if (insertUserErr) {
    console.error("Cara insert user message", insertUserErr);
    return NextResponse.json(
      { error: "Could not save your message. If this persists, run the latest database migration." },
      { status: 500 },
    );
  }

  await maybeSetConversationTitleFromUserMessage(
    session.supabase,
    conversationId,
    content,
  );

  await session.supabase
    .from("cara_pending_actions")
    .delete()
    .eq("conversation_id", conversationId);

  const snapshot = await buildCaraSalonSnapshot(
    session.supabase,
    session.organizationId,
    session.user.id,
  );

  const allRows = await listMessagesAsc(session.supabase, conversationId);
  const recentSlice = allRows.slice(-12);
  const recentTranscript = recentSlice.map((r) => r.content).join("\n");
  const recentUserTranscript = recentSlice
    .filter((r) => r.role === "user")
    .map((r) => r.content)
    .join("\n");

  const cancelRes = resolveCancelAppointmentIntent({
    userMessage: content,
    recentTranscript,
    recentUserTranscript,
    candidates: snapshot.nearTermAppointments,
    timeZone: getSalonTimeZone(),
  });

  let replyText!: string;
  let model: string | null = null;
  let pendingAction: {
    id: string;
    kind: "cancel_appointment";
    label: string;
  } | null = null;

  const connectCancelCopy =
    "This workspace is on Connect—day-to-day bookings usually live on your linked platform, not as Cliste appointments—so I can’t cancel from this chat. Use your booking app or open Bookings if you keep visits in Cliste too.";

  if (!snapshot.isNative && cancelRes.tag !== "no_intent") {
    replyText = connectCancelCopy;
  } else if (cancelRes.tag === "resolved") {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: pend, error: pErr } = await session.supabase
      .from("cara_pending_actions")
      .insert({
        conversation_id: conversationId,
        organization_id: session.organizationId,
        user_id: session.user.id,
        action_type: "cancel_appointment",
        appointment_id: cancelRes.appointmentId,
        summary: cancelRes.summary,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();

    if (pErr || !pend?.id) {
      console.error("Cara pending insert", pErr);
      replyText =
        pErr && isCaraStorageUnavailableError(pErr.message)
          ? "I need the latest chat database update before I can queue cancellations from here. Ask your admin to apply migrations, then try again—or cancel directly in Bookings."
          : "I matched that visit but couldn’t save the confirmation step. Please cancel it from Bookings instead.";
    } else {
      pendingAction = {
        id: pend.id,
        kind: "cancel_appointment",
        label: cancelRes.summary,
      };
      replyText =
        `I’ve lined up a cancellation for ${cancelRes.summary}. This removes it from your Cliste diary.\n\n` +
        `If that’s the right booking, tap Confirm cancel below. Dismiss keeps it as-is.`;
    }
  } else if (cancelRes.tag === "ambiguous") {
    replyText =
      "I found more than one booking that could match. Tell me clearly which visit (for example “cancel tomorrow’s 2pm”), or cancel from Bookings.";
  } else if (cancelRes.tag === "not_found") {
    replyText =
      "I couldn’t match that to a single confirmed Cliste visit in the next several weeks. Say the customer name, day, and time (for example “cancel Brendan Wednesday next week”), or open Bookings.";
  } else {
    let bookingHandled = false;
    if (snapshot.isNative && snapshot.publishedServices.length > 0) {
      const userLines = allRows
        .filter((r) => r.role === "user")
        .map((r) => r.content);
      const bookingBlob = buildCaraBookingUserContextBlobFromRows(userLines);
      const bookingIntent = tryCaraBookingFromMessage(
        content,
        bookingBlob,
        snapshot.publishedServices,
        getSalonTimeZone(),
        new Date(),
      );
      if (bookingIntent.tag === "reject") {
        replyText = bookingIntent.reply;
        bookingHandled = true;
      } else if (bookingIntent.tag === "create") {
        const created = await createDashboardAppointment({
          supabase: session.supabase,
          organizationId: session.organizationId,
          userId: session.user.id,
          customerName: bookingIntent.customerName,
          customerPhone: bookingIntent.customerPhone,
          serviceId: bookingIntent.serviceId,
          startTimeIso: bookingIntent.startTimeIso,
          diaryOrigin: "cara",
        });
        if (created.ok) {
          replyText = created.confirmationSmsFailed
            ? `All set — I saved ${bookingIntent.summaryForReply} in Bookings. The confirmation text did not go through (${created.confirmationSmsFailed}). Tell the client or use Support if that’s unexpected.`
            : `All set — I saved ${bookingIntent.summaryForReply} in Bookings and sent the confirmation SMS.`;
        } else {
          replyText = `I parsed a booking (${bookingIntent.summaryForReply}) but could not save it: ${created.message}`;
        }
        bookingHandled = true;
      }
    }

    if (!bookingHandled) {
      const turns = sliceForOpenAi(allRows);
      try {
        const out = await generateAssistantReply(
          turns,
          snapshot.text,
          snapshot.salonName,
        );
        replyText = out.text;
        model = out.model;
      } catch (e) {
        console.error("Cara reply generation", e);
        replyText =
          "Something went wrong while I was thinking that through. Your message was saved—try sending again in a moment.";
        model = null;
      }
    }
  }

  replyText = stripChatMarkdownDisplay(replyText.trim());

  const { error: insertAsstErr } = await session.supabase
    .from("cara_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: replyText,
    });

  if (insertAsstErr) {
    console.error("Cara insert assistant message", insertAsstErr);
    return NextResponse.json(
      { error: "Saved your message but failed to save the reply." },
      { status: 500 },
    );
  }

  await touchConversation(session.supabase, conversationId);

  await refreshConversationTopicTitleAfterReply(
    session.supabase,
    conversationId,
    content,
    replyText,
  );

  const finalRows = await listMessagesAsc(session.supabase, conversationId);
  return NextResponse.json({
    conversationId,
    messages: rowsToClientPayload(finalRows),
    model,
    pendingAction,
  });
}
