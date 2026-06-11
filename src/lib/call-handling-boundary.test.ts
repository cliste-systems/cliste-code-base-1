import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCallHandlingConflictWarnings,
  DETAILS_SURVEY_WARNING_THRESHOLD,
  lintRuleVsRuleConflicts,
  looksLikeOpeningHours,
  validateCallHandlingAdd,
} from "./call-handling-boundary";
import { compileCaraPrompt } from "./compile-cara-prompt";

const emptyCaps = {
  transfer: false,
  book: false,
  sendLink: false,
  sendFile: false,
  email: false,
  whatsapp: false,
  takeMessage: true,
};

describe("call-handling-boundary", () => {
  it("blocks compliance override rules", () => {
    const result = validateCallHandlingAdd(
      "Don't say you're an AI",
      "rule",
      emptyCaps,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.block, /legal disclosure/i);
    }
  });

  it("blocks payment details on details and rules", () => {
    for (const kind of ["detail", "rule"] as const) {
      const result = validateCallHandlingAdd("Take their card details", kind, emptyCaps);
      assert.equal(result.ok, false);
    }
  });

  it("warns on sensitive data without blocking", () => {
    const result = validateCallHandlingAdd("PPS number", "detail", emptyCaps);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.warnings?.join(" ") ?? "", /sensitive personal data/i);
    }
  });

  it("warns when booking is mentioned without capability", () => {
    const result = validateCallHandlingAdd(
      "Always book them into the calendar",
      "rule",
      emptyCaps,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.warnings?.join(" ") ?? "", /can't book/i);
    }
  });

  it("warns on photo requests", () => {
    const result = validateCallHandlingAdd(
      "Take photos of the damage",
      "rule",
      emptyCaps,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.warnings?.join(" ") ?? "", /can't take photos/i);
    }
  });

  it("detects hours-shaped rules", () => {
    assert.equal(looksLikeOpeningHours("Closed next Friday"), true);
  });

  it("lints always vs never rule pairs", () => {
    const warnings = lintRuleVsRuleConflicts([
      "Always discuss pricing on the phone",
      "Never discuss pricing with callers",
    ]);
    assert.equal(warnings.length, 1);
  });

  it("uses survey threshold of 7", () => {
    assert.equal(DETAILS_SURVEY_WARNING_THRESHOLD, 7);
  });
});

describe("compileCaraPrompt call handling", () => {
  it("includes precedence stack and available actions", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      transferNumber: "+353 1 234 5678",
      routes: [{ trigger: "directions", action: "text them the saved link" }],
    });
    assert.match(prompt, /never change/);
    assert.match(prompt, /AI and that the call may be recorded/);
    assert.match(prompt, /don't guess/);
    assert.match(prompt, /On a call, I can only promise/);
    assert.match(prompt, /only promise what's listed above/);
    assert.match(prompt, /Put them through/);
    assert.match(prompt, /Text them a link/);
  });

  it("includes conversational collection guidance", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      detailsToCollect: "Preferred day",
    });
    assert.match(prompt, /fits what they called about/);
    assert.match(prompt, /never read a list like a form/);
  });

  it("omits empty business rules section", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      businessRules: [],
    });
    assert.doesNotMatch(prompt, /Your rules —/);
  });

  it("fixes broken call-flow fallback notes", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      routes: [{ trigger: "Booking link", action: "text them the saved link" }],
      fallbackNote: "name and phone number",
    });
    assert.match(prompt, /take a message with their name, phone number/);
    assert.doesNotMatch(prompt, /I name and phone number/);
  });

  it("includes photo handling in safety defaults", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
    });
    assert.match(prompt, /photos, pictures, or video/);
  });
});

describe("buildCallHandlingConflictWarnings", () => {
  it("flags never-quote rule against FAQ prices", () => {
    const warnings = buildCallHandlingConflictWarnings({
      businessRules: ["Never quote a price over the phone"],
      detailsToCollect: [],
      faqs: [
        {
          question: "How much?",
          answer: "Consultations start at €50.",
        },
      ],
      businessFiles: [],
    });
    assert.equal(warnings.some((w) => w.id.includes("rule-faq-price")), true);
  });
});
