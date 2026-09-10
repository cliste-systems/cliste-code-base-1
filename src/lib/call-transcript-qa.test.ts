import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessTranscriptQuality } from "@/lib/call-transcript-qa";

describe("assessTranscriptQuality", () => {
  it("flags agent silence when caller is unanswered at end", () => {
    const result = assessTranscriptQuality({
      transcript: `Assistant: Hello
Caller: Can you hear me?
Caller: Hello. Can you hear me?`,
      businessName: "Murphy's SuperValu Killarney",
      durationSeconds: 27,
    });
    assert.equal(result.agentWentSilent, true);
    assert.equal(result.needsReview, true);
    assert.equal(result.acceptable, false);
  });

  it("passes a normal exchange", () => {
    const result = assessTranscriptQuality({
      transcript: `Assistant: Hi, how can I help?
Caller: What time do you close?
Assistant: We close at 9pm.`,
      transcriptReview: `Assistant: Hi, how can I help?
Caller: What time do you close?
Assistant: We close at 9pm.`,
      businessName: "Murphy's SuperValu Killarney",
      durationSeconds: 40,
    });
    assert.equal(result.acceptable, true);
    assert.equal(result.needsReview, false);
  });
});
