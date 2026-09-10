import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCallTestHealth } from "@/lib/call-testing-health";

describe("computeCallTestHealth", () => {
  it("fails when greeting never played", () => {
    const result = computeCallTestHealth({
      durationSeconds: 10,
      transcript: "Caller: hello",
      diagnostics: {
        latency: {},
        events: [],
        greetingPlayed: false,
        disclosureConfirmed: true,
      },
    });
    assert.equal(result.status, "fail");
  });

  it("passes a healthy call", () => {
    const transcript = "Assistant: Hi\nCaller: I need paint\nAssistant: Sure, what aisle?";
    const result = computeCallTestHealth({
      durationSeconds: 45,
      transcript,
      transcriptReview: transcript,
      businessName: "Murphy's SuperValu Killarney",
      diagnostics: {
        latency: { greetingMs: 800, replyP50: 1200 },
        events: [],
        greetingPlayed: true,
        disclosureConfirmed: true,
      },
    });
    assert.equal(result.status, "pass");
  });
});
