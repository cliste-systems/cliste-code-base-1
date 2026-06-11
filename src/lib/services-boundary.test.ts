import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dedupeServiceChips,
  EMPTY_OFFER_LIST_INSTRUCTION,
  findExactInList,
  findNearDuplicate,
  lintExclusionConflicts,
  looksLikeExclusion,
  normalizeServiceChip,
  splitServiceChipInput,
} from "./services-boundary";
import { compileCaraPrompt } from "./compile-cara-prompt";

describe("services-boundary", () => {
  it("normalises and dedupes chips case-insensitively", () => {
    assert.equal(normalizeServiceChip("  Plumbing   "), "Plumbing");
    assert.deepEqual(dedupeServiceChips(["Plumbing", "plumbing ", "Heating"]), [
      "Plumbing",
      "Heating",
    ]);
  });

  it("detects near-duplicates", () => {
    assert.equal(findNearDuplicate("colour", ["colours"]), "colours");
    assert.equal(
      findNearDuplicate("emergency plumbing", ["Plumbing"]),
      "Plumbing",
    );
  });

  it("detects negation-shaped offer input", () => {
    assert.equal(looksLikeExclusion("everything but walk-ins"), true);
    assert.equal(looksLikeExclusion("Consultations"), false);
  });

  it("splits comma input for preview", () => {
    assert.deepEqual(splitServiceChipInput("A, B, C"), ["A", "B", "C"]);
  });

  it("blocks identical cross-list matches via helper", () => {
    assert.equal(findExactInList("Plumbing", ["plumbing"]), "plumbing");
  });

  it("lints exclusion vs FAQ answer overlap", () => {
    const conflicts = lintExclusionConflicts(
      ["gas boiler work"],
      [
        {
          question: "Do you service gas boilers?",
          answer: "Yes, we service gas boiler work across the county.",
        },
      ],
      "",
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.location, "faq");
  });
});

describe("compileCaraPrompt services boundary", () => {
  it("includes hardened instructions when lists exist", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      servicesOffered: "Consultations\nQuotes",
      servicesNotOffered: "Same-day jobs",
    });
    assert.match(prompt, /won't use your exact category names/);
    assert.match(prompt, /more specific entry wins/);
    assert.match(prompt, /several things at once/);
  });

  it("degrades safely when offer list is empty", () => {
    const prompt = compileCaraPrompt({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      servicesNotOffered: "Walk-in only",
    });
    assert.match(prompt, new RegExp(EMPTY_OFFER_LIST_INSTRUCTION.slice(0, 40)));
    assert.doesNotMatch(prompt, /^We offer:/m);
  });
});
