import { NextResponse } from "next/server";

import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "@/lib/onboarding-voice-presets";
import { synthesizeElevenLabsSpeech } from "@/lib/elevenlabs-voice";
import {
  getVoiceApiRateLimitStatus,
  recordVoiceApiRequest,
  voiceApiFingerprint,
  voiceApiRateLimitMessage,
} from "@/lib/voice-api-rate-limit";
import { auditVoiceGreetingSecurityEvent } from "@/lib/voice-greeting-audit";
import {
  greetingLineIsInappropriate,
  validateVoiceGreetingGuardrails,
} from "@/lib/voice-greeting-guardrails";
import {
  greetingScriptTooLong,
  sanitizeGreetingLine,
  sanitizeVoiceGreetingPayload,
} from "@/lib/voice-greeting-security";
import { DEFAULT_GREETING_CLOSING } from "@/lib/voice-greeting";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  greetingIntro?: string;
  greetingClosing?: string;
};

const GUARDRAIL_MESSAGE =
  "This greeting can't include offensive or inappropriate language — keep it professional for callers.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const organizationId = profile?.organization_id as string | undefined;
  const fingerprint = voiceApiFingerprint(
    request.headers,
    `voice-preview:${user.id}`,
  );
  const rateLimit = await getVoiceApiRateLimitStatus("voice_preview", fingerprint);

  if (!rateLimit.allowed) {
    if (organizationId) {
      await auditVoiceGreetingSecurityEvent({
        source: "voice_preview",
        outcome: "rate_limited",
        actorUserId: user.id,
        organizationId,
        eventType: "voice_greeting_rate_limited",
        scriptLength: 0,
      });
    }
    return NextResponse.json(
      { error: voiceApiRateLimitMessage(rateLimit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = sanitizeGreetingLine(String(body.text ?? ""));
  if (!text) {
    return NextResponse.json({ error: "Nothing to preview." }, { status: 400 });
  }
  if (greetingScriptTooLong(text)) {
    return NextResponse.json({ error: "Preview text is too long." }, { status: 400 });
  }

  const introRaw = String(body.greetingIntro ?? "").trim();
  const closingRaw = String(body.greetingClosing ?? "").trim();
  if (introRaw || closingRaw) {
    const sanitized = sanitizeVoiceGreetingPayload({
      greetingIntro: introRaw,
      greetingClosing: closingRaw,
      defaultClosing: DEFAULT_GREETING_CLOSING,
    });
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.message }, { status: 400 });
    }

    let businessName = "";
    if (organizationId) {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();
      businessName = String(org?.name ?? "").trim();
    }

    const guardrail = validateVoiceGreetingGuardrails({
      greetingIntro: sanitized.greetingIntro,
      greetingClosing: sanitized.greetingClosing,
      businessName,
    });
    if (!guardrail.ok) {
      if (organizationId) {
        await auditVoiceGreetingSecurityEvent({
          source: "voice_preview",
          outcome: "failure",
          actorUserId: user.id,
          organizationId,
          eventType: "voice_greeting_guardrail_blocked",
          introIssue: guardrail.introIssue,
          closingIssue: guardrail.closingIssue,
          introLength: sanitized.greetingIntro.length,
          closingLength: sanitized.greetingClosing.length,
        });
      }
      return NextResponse.json(
        {
          error: guardrail.message,
          introIssue: guardrail.introIssue,
          closingIssue: guardrail.closingIssue,
        },
        { status: 400 },
      );
    }
  } else if (greetingLineIsInappropriate(text)) {
    if (organizationId) {
      await auditVoiceGreetingSecurityEvent({
        source: "voice_preview",
        outcome: "failure",
        actorUserId: user.id,
        organizationId,
        eventType: "voice_greeting_guardrail_blocked",
        scriptLength: text.length,
      });
    }
    return NextResponse.json({ error: GUARDRAIL_MESSAGE }, { status: 400 });
  }

  await recordVoiceApiRequest("voice_preview", fingerprint);

  try {
    const audio = await synthesizeElevenLabsSpeech({
      text,
      voiceId: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
    });
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice preview failed.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
