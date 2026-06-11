import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAnswersConflictWarnings,
  detectCanonicalQuestion,
  faqsForPrompt,
  lintFaqFields,
} from "./answers-boundary";
import { buildFileExtractionPreview, sliceFileTextForPrompt } from "./business-file-prompt";
import { compileCaraPrompt } from "./compile-cara-prompt";

describe("answers-boundary", () => {
  it("detects canonical service questions", () => {
    const match = detectCanonicalQuestion("What services do you offer?");
    assert.equal(match?.category, "services");
    assert.equal(match?.setupLabel, "Services");
  });

  it("warns on spoken URLs in answers", () => {
    const warnings = lintFaqFields({
      faqs: [{ question: "Where online?", answer: "Visit https://example.com" }],
      index: 0,
    });
    assert.equal(
      warnings.some((warning) => warning.kind === "spoken_url"),
      true,
    );
  });

  it("warns on long spoken answers", () => {
    const warnings = lintFaqFields({
      faqs: [
        {
          question: "Tell me everything",
          answer: Array.from({ length: 80 }, () => "word").join(" "),
        },
      ],
      index: 0,
    });
    assert.equal(warnings.some((warning) => warning.kind === "length"), true);
  });

  it("omits empty-answer FAQs from prompt compilation list", () => {
    assert.equal(
      faqsForPrompt([{ question: "Hours?", answer: "" }]).length,
      0,
    );
  });

  it("flags FAQ vs file price conflicts", () => {
    const warnings = buildAnswersConflictWarnings({
      faqs: [{ question: "Price?", answer: "Consultations are €80." }],
      businessFiles: [
        {
          id: "f1",
          fileName: "prices.csv",
          fileType: "csv",
          mimeType: "text/csv",
          sizeBytes: 100,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "price_list",
          processingStatus: "ready",
          extractedText: "Consultation €95",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    assert.equal(warnings.length > 0, true);
  });
});

describe("business-file-prompt", () => {
  it("builds extraction preview with line count", () => {
    const preview = buildFileExtractionPreview("a\nb\nc\n");
    assert.equal(preview?.totalCount, 3);
    assert.equal(preview?.items.length, 3);
  });

  it("truncates oversized file text for prompt injection", () => {
    const huge = "x".repeat(20_000);
    const slice = sliceFileTextForPrompt(huge, 1000);
    assert.equal(slice?.wasTruncated, true);
    assert.ok(slice!.text.length < huge.length);
  });
});

describe("compileCaraPrompt answers + files", () => {
  it("includes FAQ matching and precedence language", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      faqs: [{ question: "Do you quote?", answer: "Yes, we quote on request." }],
      businessFiles: [],
    });
    assert.match(prompt, /by meaning, not exact wording/);
    assert.match(prompt, /approved business content/);
    assert.match(prompt, /structured setup/);
  });

  it("skips FAQs with empty answers", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      faqs: [{ question: "Empty?", answer: "" }],
    });
    assert.doesNotMatch(prompt, /Empty\?/);
  });

  it("includes answer-enabled file content and sendable actions", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      businessFiles: [
        {
          id: "f1",
          fileName: "menu.csv",
          fileType: "csv",
          mimeType: "text/csv",
          sizeBytes: 100,
          answerEnabled: true,
          sendEnabled: true,
          documentKind: "menu",
          processingStatus: "ready",
          extractedText: "Soup €5",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    assert.match(prompt, /From uploaded files/);
    assert.match(prompt, /Soup €5/);
    assert.match(prompt, /Text the caller the menu/);
  });
});
