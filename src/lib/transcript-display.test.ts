import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripToolLinesFromTranscript } from "./transcript-display";

describe("stripToolLinesFromTranscript", () => {
  it("removes tool request and result blocks", () => {
    const input = [
      "Assistant: Right so — we have a few different types.",
      '[Tool] searchSuperValuProducts {"intent":"price","query":"avocados"}',
      '[Tool result] {"ok":true,"message":"Several types or brands match"}',
      "Caller: Is there any of them on offer?",
    ].join("\n\n");

    assert.equal(
      stripToolLinesFromTranscript(input),
      [
        "Assistant: Right so — we have a few different types.",
        "Caller: Is there any of them on offer?",
      ].join("\n\n"),
    );
  });
});
