import "server-only";

import {
  CLISTE_ELEVENLABS_VOICE_SETTINGS,
  resolveElevenLabsModelId,
} from "@/lib/cara-elevenlabs-voice";
import { MAX_GREETING_SCRIPT_LENGTH } from "@/lib/voice-greeting-security";

export type ElevenLabsVoiceSummary = {
  voiceId: string;
  name: string;
};

let cachedVoices: { fetchedAt: number; voices: ElevenLabsVoiceSummary[] } | null =
  null;

const VOICES_CACHE_MS = 15 * 60 * 1000;

function elevenLabsApiBaseUrl(): string {
  return (
    process.env.ELEVENLABS_API_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.elevenlabs.io/v1"
  );
}

function elevenLabsTtsBaseUrl(): string {
  return `${elevenLabsApiBaseUrl()}/text-to-speech`;
}

/** List ElevenLabs voices (cached ~15 min). Returns empty when API key missing. */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoiceSummary[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return [];

  const now = Date.now();
  if (cachedVoices && now - cachedVoices.fetchedAt < VOICES_CACHE_MS) {
    return cachedVoices.voices;
  }

  const response = await fetch(`${elevenLabsApiBaseUrl()}/voices`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn("[elevenlabs] list_voices_failed", { status: response.status });
    return cachedVoices?.voices ?? [];
  }

  const body = (await response.json()) as { voices?: unknown[] };
  const voices = (body.voices ?? [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const voiceId = String(row.voice_id ?? "").trim();
      const name = String(row.name ?? "").trim();
      if (!voiceId) return null;
      return { voiceId, name: name || voiceId };
    })
    .filter((v): v is ElevenLabsVoiceSummary => v !== null);

  cachedVoices = { fetchedAt: now, voices };
  return voices;
}

export function resolveElevenLabsVoiceName(
  voiceId: string,
  voices: ElevenLabsVoiceSummary[],
): string | null {
  const id = voiceId.trim();
  if (!id) return null;
  return voices.find((v) => v.voiceId === id)?.name ?? null;
}

export async function synthesizeElevenLabsSpeech(input: {
  text: string;
  voiceId: string;
  modelId?: string;
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
        model_id: input.modelId ?? resolveElevenLabsModelId(),
        voice_settings: CLISTE_ELEVENLABS_VOICE_SETTINGS,
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
