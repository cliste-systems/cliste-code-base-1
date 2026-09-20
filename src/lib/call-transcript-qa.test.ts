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

  it("flags thanks for that and duplicate closings", () => {
    const transcript = `Assistant: Gotcha, thanks for that. Are you all sorted?
Caller: Yeah, that's perfect.
Assistant: Lovely, Brendan — thanks for calling Kavanaghs SuperValu Donegal Town. Take care now!
Assistant: Lovely, Brendan — thanks for calling Kavanaghs SuperValu Donegal Town. Take care now!`;
    const result = assessTranscriptQuality({
      transcript,
      transcriptReview: transcript,
      businessName: "Kavanaghs SuperValu Donegal Town",
      durationSeconds: 74,
    });
    assert.equal(result.needsReview, true);
    assert.ok(
      result.issues.some((issue) => /thanks for that/i.test(issue)),
    );
    assert.ok(
      result.issues.some((issue) => /duplicate assistant/i.test(issue)),
    );
  });
});
