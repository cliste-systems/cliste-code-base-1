import "server-only";

import { MAX_GREETING_SCRIPT_LENGTH } from "@/lib/voice-greeting-security";

function elevenLabsTtsBaseUrl(): string {
  return (
    process.env.ELEVENLABS_API_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.elevenlabs.io/v1/text-to-speech"
  );
}

export async function synthesizeElevenLabsSpeech(input: {
  text: string;
  voiceId: string;
}): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Voice preview is not configured.");
  }

  const text = input.text.trim();
  if (!text) {
    throw new Error("Nothing to preview.");
  }
  if (text.length > MAX_GREETING_SCRIPT_LENGTH) {
    throw new Error("Preview text is too long.");
  }

  const response = await fetch(
    `${elevenLabsTtsBaseUrl()}/${encodeURIComponent(input.voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.warn("[elevenlabs] tts_request_failed", {
      status: response.status,
      textLength: text.length,
    });
    throw new Error("Voice preview failed.");
  }

  return response.arrayBuffer();
}
