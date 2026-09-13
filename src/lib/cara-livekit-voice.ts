/** Cartesia "Siobhan - Warm Welcomer" — same default as code-base-2 voice worker. */
export const CARTESIA_SIOBHAN_VOICE_ID =
  "d79d2b77-9192-4e10-9407-5d43ca034803";

/** Cartesia inference voices are UUIDs — ignore stale ElevenLabs ids on org rows. */
export function isCartesiaVoiceId(voiceId: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    voiceId?.trim() ?? "",
  );
}

/** LiveKit Inference TTS model — aligned with code-base-2 `resolveTtsConfig`. */
export function resolveLiveKitTtsModel(): string {
  return (
    process.env.LIVEKIT_INFERENCE_TTS_MODEL?.trim() || "cartesia/sonic-3.6"
  );
}

export function resolveLiveKitTtsLanguage(): string {
  return process.env.LIVEKIT_INFERENCE_TTS_LANGUAGE?.trim() || "en";
}

/**
 * Resolve Cartesia voice id for previews — same order as code-base-2
 * `resolveTtsConfig` / `resolveCartesiaVoiceId`.
 */
export function resolveOrgCartesiaVoiceId(
  agentVoiceId: string | null | undefined,
): string {
  const fromOrg = agentVoiceId?.trim();
  if (fromOrg && isCartesiaVoiceId(fromOrg)) return fromOrg;

  const fromEnv = process.env.LIVEKIT_INFERENCE_TTS_VOICE?.trim();
  if (fromEnv && isCartesiaVoiceId(fromEnv)) return fromEnv;

  return CARTESIA_SIOBHAN_VOICE_ID;
}
