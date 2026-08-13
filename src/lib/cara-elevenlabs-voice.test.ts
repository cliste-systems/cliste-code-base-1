import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLISTE_DEFAULT_ELEVENLABS_MODEL_ID,
  CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
} from "./onboarding-voice-presets";
import {
  resolveElevenLabsModelId,
  resolveOrgElevenLabsVoiceId,
} from "./cara-elevenlabs-voice";

describe("cara-elevenlabs-voice", () => {
  it("prefers org agent_voice_id", () => {
    assert.equal(
      resolveOrgElevenLabsVoiceId("org-voice-id"),
      "org-voice-id",
    );
  });

  it("falls back to default voice id", () => {
    assert.equal(
      resolveOrgElevenLabsVoiceId(null),
      CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
    );
  });

  it("defaults model to flash v2.5 like the worker", () => {
    assert.equal(resolveElevenLabsModelId(), CLISTE_DEFAULT_ELEVENLABS_MODEL_ID);
  });
});
