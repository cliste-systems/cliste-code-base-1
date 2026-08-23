import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { synthesizeElevenLabsSpeech } from "@/lib/elevenlabs-voice";
import { voiceLegalDisclosure } from "@/lib/voice-greeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  voiceId?: string;
  assistantDisplayName?: string;
};

export async function POST(request: Request) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const assistantName = String(body.assistantDisplayName ?? "Cara").trim() || "Cara";
  const text =
    String(body.text ?? "").trim() ||
    `Hello, ${voiceLegalDisclosure(assistantName)} How can I help you today?`;
  const voiceId = String(body.voiceId ?? "").trim();
  if (!voiceId) {
    return NextResponse.json({ error: "Voice ID is required." }, { status: 400 });
  }

  try {
    const audio = await synthesizeElevenLabsSpeech({ text, voiceId });
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
