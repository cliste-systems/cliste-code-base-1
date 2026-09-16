import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prepareVoicePreviewTtsText } from "./voice-preview-tts-text";

describe("voice-preview-tts-text", () => {
  it("applies live-call pronunciation for Cara and Kavanaghs", () => {
    const out = prepareVoicePreviewTtsText(
      "You're through to Kavanaghs SuperValu Donegal Town — I'm Cara, the AI assistant.",
    );
    assert.match(out, /Kav-an-as/);
    assert.match(out, /Doneygall Town/);
    assert.match(out, /I'm Car-ah,/);
    assert.doesNotMatch(out, /\bCara\b/);
  });
});
