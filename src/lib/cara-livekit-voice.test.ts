import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CARTESIA_SIOBHAN_VOICE_ID,
  isCartesiaVoiceId,
  resolveLiveKitTtsModel,
  resolveOrgCartesiaVoiceId,
} from "./cara-livekit-voice";

describe("cara-livekit-voice", () => {
  it("recognises cartesia voice uuids", () => {
    assert.equal(isCartesiaVoiceId(CARTESIA_SIOBHAN_VOICE_ID), true);
    assert.equal(isCartesiaVoiceId("C92s6vssSLlabgIln1iY"), false);
  });

  it("prefers org cartesia agent_voice_id", () => {
    assert.equal(
      resolveOrgCartesiaVoiceId(CARTESIA_SIOBHAN_VOICE_ID),
      CARTESIA_SIOBHAN_VOICE_ID,
    );
  });

  it("ignores stale elevenlabs ids and falls back to siobhan", () => {
    assert.equal(
      resolveOrgCartesiaVoiceId("C92s6vssSLlabgIln1iY"),
      CARTESIA_SIOBHAN_VOICE_ID,
    );
    assert.equal(resolveOrgCartesiaVoiceId(null), CARTESIA_SIOBHAN_VOICE_ID);
  });

  it("defaults model to sonic 3.6 like the worker", () => {
    assert.equal(resolveLiveKitTtsModel(), "cartesia/sonic-3.6");
  });
});
