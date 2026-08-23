import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { greetingDisclosesAi } from "./greeting-discloses-ai";
import { voiceLegalDisclosure } from "./voice-greeting";

describe("greetingDisclosesAi", () => {
  it("accepts the standard legal disclosure block", () => {
    const greeting = `You're through to Test Store — ${voiceLegalDisclosure("Cara")} How can I help?`;
    assert.equal(greetingDisclosesAi(greeting, "Cara"), true);
  });

  it("rejects greeting without AI disclosure", () => {
    assert.equal(
      greetingDisclosesAi("You're through to Test Store — how can I help?", "Cara"),
      false,
    );
  });

  it("accepts explicit AI + recording language", () => {
    assert.equal(
      greetingDisclosesAi(
        "Welcome to Test Store. I'm Cara, your virtual assistant. Calls may be recorded.",
        "Cara",
      ),
      true,
    );
  });
});
