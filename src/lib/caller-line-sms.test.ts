import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { callerSmsEligibility } from "./caller-line-sms";

describe("callerSmsEligibility", () => {
  it("allows Irish mobiles", () => {
    const result = callerSmsEligibility("+353872715938");
    assert.equal(result.canText, true);
    if (result.canText) {
      assert.equal(result.e164, "+353872715938");
    }
  });

  it("blocks Irish landlines", () => {
    const result = callerSmsEligibility("+353749123456");
    assert.equal(result.canText, false);
    if (!result.canText) {
      assert.match(result.reason, /landline/i);
    }
  });

  it("blocks Dublin landlines", () => {
    const result = callerSmsEligibility("01 234 5678");
    assert.equal(result.canText, false);
  });

  it("blocks withheld numbers", () => {
    const result = callerSmsEligibility("anonymous");
    assert.equal(result.canText, false);
  });

  it("allows UK mobiles", () => {
    const result = callerSmsEligibility("+447700900123");
    assert.equal(result.canText, true);
  });

  it("blocks UK landlines", () => {
    const result = callerSmsEligibility("+441234567890");
    assert.equal(result.canText, false);
  });
});
