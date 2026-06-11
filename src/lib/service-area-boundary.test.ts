import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectCompoundPlaceChip,
  formatRadiusChip,
  formatServiceAreaForPrompt,
  normalizeServiceAreaCountyItems,
  parseRadiusChip,
  SERVICE_AREA_COVERAGE_INSTRUCTION,
  stripIncludingClause,
} from "./service-area-boundary";
import { compileCaraPrompt } from "./compile-cara-prompt";

describe("service area radius", () => {
  it("parses and formats within-km chips", () => {
    assert.deepEqual(parseRadiusChip("Within 30km"), {
      km: 30,
      label: "Within 30km",
    });
    assert.equal(formatRadiusChip(30), "Within 30km");
  });

  it("formats radius relative to business location in prompt", () => {
    const phrase = formatServiceAreaForPrompt(
      ["Within 30km", "Nationwide"],
      "Letterkenny, Co. Donegal",
    );
    assert.match(phrase, /Within 30km of Letterkenny/i);
    assert.match(phrase, /Nationwide/i);
  });

  it("appends town exclusions to county phrase", () => {
    const phrase = formatServiceAreaForPrompt(
      ["Donegal", "Sligo"],
      undefined,
      ["Killybegs", "Bundoran"],
    );
    assert.match(phrase, /Donegal, Sligo \(excluding Killybegs, Bundoran\)/);
  });
});

describe("including clause cleanup", () => {
  it("strips including tails from county chips", () => {
    assert.equal(
      stripIncludingClause("Donegal including Letterkenny"),
      "Donegal",
    );
  });

  it("normalises legacy town lists to counties where possible", () => {
    assert.deepEqual(
      normalizeServiceAreaCountyItems([
        "Donegal including Letterkenny",
        "Carndonagh",
        "Ballybofey",
        "Lifford",
        "Donegal Town and Ballyshannon",
      ]),
      ["Donegal", "Carndonagh", "Ballybofey", "Lifford", "Donegal Town and Ballyshannon"],
    );
  });
});

describe("compound place chips", () => {
  it("detects and splits compound places", () => {
    assert.deepEqual(detectCompoundPlaceChip("Letterkenny and Ballybofey"), [
      "Letterkenny",
      "Ballybofey",
    ]);
  });
});

describe("compileCaraPrompt service area", () => {
  it("includes coverage ladder instruction", () => {
    const prompt = compileCaraPrompt({
      businessName: "Acme",
      assistantDisplayName: "Cara",
      businessType: "Plumber",
      serviceArea: "Donegal\nSligo",
      serviceAreaExclusions: "Killybegs",
      locationAddress: "Main St, Letterkenny",
    });
    assert.match(prompt, new RegExp(SERVICE_AREA_COVERAGE_INSTRUCTION.slice(0, 40)));
    assert.match(prompt, /excluding Killybegs/);
  });

  it("backstops greeting disclosure in compiled prompt", () => {
    const prompt = compileCaraPrompt({
      businessName: "Acme",
      assistantDisplayName: "Cara",
      businessType: "Plumber",
      greeting: "You're through to Acme — How can I help?",
    });
    assert.match(prompt, /AI assistant/i);
    assert.match(prompt, /recorded/i);
  });
});
