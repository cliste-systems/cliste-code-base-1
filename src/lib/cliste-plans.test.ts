import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planFromPriceCents,
  planFromStripePriceId,
} from "./cliste-plans.data";

describe("planFromPriceCents", () => {
  it("maps business price without colliding enterprise", () => {
    assert.equal(planFromPriceCents(44900), "business");
    assert.equal(planFromPriceCents(0), null);
  });
});

describe("planFromStripePriceId", () => {
  it("resolves tier from lookup key", () => {
    assert.equal(planFromStripePriceId("cliste_plan_pro_monthly"), "pro");
    assert.equal(planFromStripePriceId("cliste_plan_enterprise_annual"), "enterprise");
    assert.equal(planFromStripePriceId("unknown_key"), null);
  });
});
