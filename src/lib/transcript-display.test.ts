import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTranscriptTurns, stripToolLinesFromTranscript } from "./transcript-display";

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

describe("parseTranscriptTurns", () => {
  it("splits assistant and caller lines into spaced turns", () => {
    const input = [
      "Assistant: Hello, how can I help?",
      "Caller: I need to return some chicken.",
      "Assistant: No bother — I can take a message.",
    ].join("\n");

    assert.deepEqual(parseTranscriptTurns(input), [
      { speaker: "Assistant", text: "Hello, how can I help?" },
      { speaker: "Caller", text: "I need to return some chicken." },
      { speaker: "Assistant", text: "No bother — I can take a message." },
    ]);
  });

  it("keeps wrapped lines with the same speaker", () => {
    const input = [
      "Assistant: Hello there.",
      "This continues on the next line.",
      "Caller: Thanks.",
    ].join("\n");

    assert.deepEqual(parseTranscriptTurns(input), [
      { speaker: "Assistant", text: "Hello there.\nThis continues on the next line." },
      { speaker: "Caller", text: "Thanks." },
    ]);
  });
});
