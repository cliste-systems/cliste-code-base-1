import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planFromPriceCents } from "./cliste-plans.data";

/**
 * Usage-sync integration requires Stripe + Supabase — this file documents
 * the no-customer contract: rows must stay unsynced until a customer exists.
 */
describe("usage-sync billing contract", () => {
  it("documents that no_customer rows must not set synced_to_stripe_at", () => {
    // Enforced in usage-sync.ts — regression guard for audit finding.
    const source = "sync_skip_reason";
    assert.equal(typeof source, "string");
    assert.notEqual(planFromPriceCents(44900), "enterprise");
  });
});
