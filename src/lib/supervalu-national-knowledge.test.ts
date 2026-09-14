import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileCaraPrompt } from "./compile-cara-prompt";
import {
  buildRetailStoreFactsSection,
  buildSupervaluNationalKnowledgeSection,
  REAL_REWARDS_HELPDESK_PHONE,
} from "./supervalu-national-knowledge";

describe("buildSupervaluNationalKnowledgeSection", () => {
  it("includes Real Rewards helpdesk and escalation rules", () => {
    const section = buildSupervaluNationalKnowledgeSection();
    assert.match(section, /Real Rewards/i);
    assert.match(section, new RegExp(REAL_REWARDS_HELPDESK_PHONE));
    assert.match(section, /never quote a caller's points balance/i);
    assert.match(section, /searchSuperValuProducts/i);
  });
});

describe("buildRetailStoreFactsSection", () => {
  it("returns null when no store facts configured", () => {
    assert.equal(buildRetailStoreFactsSection({}), null);
  });

  it("includes loyalty and store phone when configured", () => {
    const section = buildRetailStoreFactsSection({
      loyaltyProgram: "Real Rewards",
      storePublicNumber: "+353749722977",
    });
    assert.match(section ?? "", /Real Rewards/);
    assert.match(section ?? "", /749722977/);
  });
});

describe("compileCaraPrompt SuperValu knowledge", () => {
  it("includes national and store facts sections when provided", () => {
    const prompt = compileCaraPrompt({
      businessName: "Kavanaghs SuperValu Donegal Town",
      assistantDisplayName: "Cara",
      businessType: "Retail & Grocery",
      supervaluNationalKnowledgeSection: buildSupervaluNationalKnowledgeSection(),
      retailStoreFactsSection:
        buildRetailStoreFactsSection({
          loyaltyProgram: "Real Rewards",
          storePublicNumber: "+353749722977",
        }) ?? undefined,
    });

    assert.match(prompt, /Real Rewards Helpdesk/i);
    assert.match(prompt, new RegExp(REAL_REWARDS_HELPDESK_PHONE));
    assert.match(prompt, /This store/i);
    assert.match(prompt, /749722977/);
  });
});
