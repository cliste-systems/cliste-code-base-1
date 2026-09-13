import "server-only";

import { AccessToken } from "livekit-server-sdk";
import WebSocket from "ws";

const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_ENCODING = "pcm_s16le";
const CONNECT_TIMEOUT_MS = 10_000;
const SYNTH_TIMEOUT_MS = 30_000;

type TtsServerEvent =
  | { type: "session.created"; session_id: string }
  | { type: "output_audio"; audio: string; session_id: string }
  | { type: "done"; session_id: string }
  | { type: "session.closed"; session_id: string }
  | { type: "error"; message?: string; session_id?: string };

function getDefaultInferenceUrl(): string {
  const inferenceUrl = process.env.LIVEKIT_INFERENCE_URL?.trim();
  if (inferenceUrl) return inferenceUrl;

  const livekitUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  if (livekitUrl.includes(".staging.livekit.cloud")) {
    return "https://agent-gateway.staging.livekit.cloud/v1";
  }
  return "https://agent-gateway.livekit.cloud/v1";
}

function resolveLiveKitCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey =
    process.env.LIVEKIT_INFERENCE_API_KEY?.trim() ||
    process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret =
    process.env.LIVEKIT_INFERENCE_API_SECRET?.trim() ||
    process.env.LIVEKIT_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    throw new Error(
      "LiveKit inference is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).",
    );
  }

  return { apiKey, apiSecret };
}

async function createInferenceToken(
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const token = new AccessToken(apiKey, apiSecret, {
    identity: "voice-preview",
    ttl: 600,
  });
  token.addInferenceGrant({ perform: true });
  return token.toJwt();
}

function pcm16ToWav(pcm: Buffer, sampleRate: number, channels = 1): Buffer {
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseServerEvent(raw: WebSocket.RawData): TtsServerEvent | null {
  try {
    const event = JSON.parse(raw.toString()) as TtsServerEvent;
    if (!event?.type) return null;
    return event;
  } catch {
    return null;
  }
}

async function synthesizeViaWebSocket(input: {
  url: string;
  token: string;
  text: string;
  model: string;
  voiceId: string;
  language: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    let sessionReady = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(synthTimeout);
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      if (error) reject(error);
      else resolve(Buffer.concat(chunks));
    };

    const ws = new WebSocket(input.url, {
      headers: { Authorization: `Bearer ${input.token}` },
    });

    const connectTimeout = setTimeout(() => {
      finish(new Error("LiveKit TTS connection timed out."));
    }, CONNECT_TIMEOUT_MS);

    const synthTimeout = setTimeout(() => {
      finish(new Error("LiveKit TTS synthesis timed out."));
    }, SYNTH_TIMEOUT_MS);

    ws.once("open", () => {
      clearTimeout(connectTimeout);
      ws.send(
        JSON.stringify({
          type: "session.create",
          sample_rate: String(DEFAULT_SAMPLE_RATE),
          encoding: DEFAULT_ENCODING,
          model: input.model,
          voice: input.voiceId,
          language: input.language,
          extra: {},
        }),
      );
    });

    ws.on("message", (raw) => {
      const event = parseServerEvent(raw);
      if (!event) return;

      switch (event.type) {
        case "session.created":
          sessionReady = true;
          ws.send(
            JSON.stringify({
              type: "input_transcript",
              transcript: `${input.text} `,
              generation_config: {
                model: input.model,
                voice: input.voiceId,
                language: input.language,
              },
              extra: {},
            }),
          );
          ws.send(JSON.stringify({ type: "session.flush" }));
          break;
        case "output_audio":
          chunks.push(Buffer.from(event.audio, "base64"));
          break;
        case "done":
          ws.send(JSON.stringify({ type: "session.close" }));
          finish();
          break;
        case "session.closed":
          if (sessionReady) finish();
          break;
        case "error":
          finish(
            new Error(event.message?.trim() || "LiveKit TTS synthesis failed."),
          );
          break;
        default:
          break;
      }
    });

    ws.once("error", () => {
      finish(new Error("LiveKit TTS connection failed."));
    });

    ws.once("close", () => {
      if (!settled && sessionReady && chunks.length > 0) {
        finish();
      } else if (!settled) {
        finish(new Error("LiveKit TTS connection closed unexpectedly."));
      }
    });
  });
}

/** Synthesize speech via LiveKit Inference (Cartesia Sonic) — same path as live calls. */
export async function synthesizeLiveKitInferenceSpeech(input: {
  text: string;
  model: string;
  voiceId: string;
  language?: string;
}): Promise<Buffer> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Nothing to synthesize.");
  }

  const { apiKey, apiSecret } = resolveLiveKitCredentials();
  const token = await createInferenceToken(apiKey, apiSecret);
  const baseURL = getDefaultInferenceUrl();
  const wsBase = baseURL.replace(/^http/, "ws");
  const model = input.model.trim();
  const url = `${wsBase}/tts?model=${encodeURIComponent(model)}`;

  const pcm = await synthesizeViaWebSocket({
    url,
    token,
    text,
    model,
    voiceId: input.voiceId.trim(),
    language: input.language?.trim() || "en",
  });

  if (pcm.length === 0) {
    throw new Error("LiveKit TTS returned no audio.");
  }

  return pcm16ToWav(pcm, DEFAULT_SAMPLE_RATE);
}
