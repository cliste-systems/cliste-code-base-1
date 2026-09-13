import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatSpokenDiscountLabel,
  formatSpokenEurAmount,
  formatSpokenInteger,
  speakEmbeddedEurAmounts,
} from "./spoken-eur-price";

describe("spoken eur price", () => {
  it("formats whole euro amounts", () => {
    assert.equal(formatSpokenEurAmount(4), "four euro");
    assert.equal(formatSpokenEurAmount(10), "ten euro");
  });

  it("formats euro and cent amounts in Irish retail style", () => {
    assert.equal(formatSpokenEurAmount(4.79), "four euro seventy nine");
    assert.equal(formatSpokenEurAmount(4.5), "four euro fifty");
    assert.equal(formatSpokenEurAmount(12.99), "twelve euro ninety nine");
  });

  it("speaks embedded euro symbols in labels", () => {
    assert.equal(formatSpokenDiscountLabel("Only €4"), "Only four euro");
    assert.equal(formatSpokenDiscountLabel("3 for €10"), "three for ten euro");
  });

  it("speaks per-unit prices", () => {
    assert.equal(
      speakEmbeddedEurAmounts("€11.14/kg"),
      "eleven euro fourteen per kilo",
    );
  });

  it("formats integers for multi-buy counts", () => {
    assert.equal(formatSpokenInteger(3), "three");
    assert.equal(formatSpokenInteger(79), "seventy nine");
  });
});
