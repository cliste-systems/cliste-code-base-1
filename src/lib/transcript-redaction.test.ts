import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactCallText } from "./transcript-redaction";

describe("transcript-redaction", () => {
  it("redacts Luhn-valid card numbers", () => {
    const { text, hits } = redactCallText(
      "My card is 4111 1111 1111 1111 please charge it",
    );
    assert.match(text ?? "", /\[REDACTED-CARD\]/);
    assert.ok(hits.includes("PAN"));
  });

  it("redacts Irish PPSN patterns", () => {
    const { text, hits } = redactCallText("My PPS is 1234567T");
    assert.match(text ?? "", /\[REDACTED-PPSN\]/);
    assert.ok(hits.includes("PPSN"));
  });

  it("redacts volunteered health phrases", () => {
    const { text, hits } = redactCallText(
      "I'm pregnant and need an appointment next week",
    );
    assert.match(text ?? "", /\[REDACTED-SENSITIVE\]/);
    assert.ok(hits.includes("SENSITIVE"));
  });

  it("redacts allergy mentions conservatively", () => {
    const { text, hits } = redactCallText("I'm allergic to latex products");
    assert.match(text ?? "", /\[REDACTED-SENSITIVE\]/);
    assert.ok(hits.includes("SENSITIVE"));
  });

  it("leaves ordinary booking text intact", () => {
    const input = "I'd like an appointment on Tuesday at 3pm";
    const { text, hits } = redactCallText(input);
    assert.equal(text, input);
    assert.equal(hits.length, 0);
  });
});
