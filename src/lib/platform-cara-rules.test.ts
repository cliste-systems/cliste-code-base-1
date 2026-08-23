import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PLATFORM_CARA_RULES,
  renderLegalDisclosure,
  reassembleOrgGreetingForPlatformRules,
  validatePlatformCaraRulesInput,
} from "./platform-cara-rules-shared";
import { compileCaraPrompt } from "./compile-cara-prompt";

describe("platform-cara-rules-shared", () => {
  it("renders {assistant} in legal disclosure", () => {
    const text = renderLegalDisclosure(
      "I'm {assistant}, the AI assistant. Recorded.",
      "Mia",
    );
    assert.equal(text, "I'm Mia, the AI assistant. Recorded.");
  });

  it("requires {assistant} in template validation", () => {
    const err = validatePlatformCaraRulesInput({
      ...DEFAULT_PLATFORM_CARA_RULES,
      legalDisclosureTemplate: "Hello from Cara.",
    });
    assert.ok(err?.includes("{assistant}"));
  });
});

describe("compileCaraPrompt platform rules", () => {
  it("includes custom platform behaviour rules in non-negotiables", () => {
    const prompt = compileCaraPrompt({
      businessName: "Test Shop",
      assistantDisplayName: "Cara",
      businessType: "retail",
      platformRules: {
        ...DEFAULT_PLATFORM_CARA_RULES,
        platformBehaviourRules: [
          "If they ask for a human, I do not argue — I offer transfer or take a message.",
        ],
      },
    });
    assert.match(
      prompt,
      /If they ask for a human, I do not argue/,
    );
  });

  it("uses custom transfer when disabled copy", () => {
    const prompt = compileCaraPrompt({
      businessName: "Test Shop",
      assistantDisplayName: "Cara",
      businessType: "retail",
      canTransfer: false,
      routes: [{ trigger: "speak to someone", action: "take a message" }],
      platformRules: {
        ...DEFAULT_PLATFORM_CARA_RULES,
        transferWhenDisabled: "CUSTOM: no live transfers on this line.",
      },
    });
    assert.match(prompt, /CUSTOM: no live transfers on this line/);
  });
});

describe("reassembleOrgGreetingForPlatformRules", () => {
  it("swaps legal disclosure while keeping intro and closing", () => {
    const stored =
      "You're through to Test Shop — I'm Cara, the AI assistant. This call may be recorded and transcribed. What can I get you?";
    const next = reassembleOrgGreetingForPlatformRules(
      stored,
      "Test Shop",
      "Cara",
      {
        ...DEFAULT_PLATFORM_CARA_RULES,
        legalDisclosureTemplate:
          "I'm {assistant}, your virtual assistant. Calls are recorded.",
      },
    );
    assert.match(next, /virtual assistant/);
    assert.match(next, /What can I get you/);
    assert.match(next, /You're through to Test Shop/);
  });
});
