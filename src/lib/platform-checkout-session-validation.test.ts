import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPlatformCheckoutSessionComplete,
  PlatformCheckoutNotCompleteError,
} from "./platform-checkout-session-validation";

function session(
  overrides: Partial<{
    status: string;
    payment_status: string;
    subscription: string | { id: string } | null;
  }> = {},
) {
  return {
    status: "complete",
    payment_status: "paid",
    subscription: "sub_123",
    ...overrides,
  };
}

describe("assertPlatformCheckoutSessionComplete", () => {
  it("rejects open sessions", () => {
    assert.throws(
      () =>
        assertPlatformCheckoutSessionComplete(
          session({ status: "open" }),
        ),
      PlatformCheckoutNotCompleteError,
    );
  });

  it("rejects complete sessions without a subscription", () => {
    assert.throws(
      () =>
        assertPlatformCheckoutSessionComplete(
          session({ subscription: null }),
        ),
      PlatformCheckoutNotCompleteError,
    );
  });

  it("rejects unpaid payment status", () => {
    assert.throws(
      () =>
        assertPlatformCheckoutSessionComplete(
          session({ payment_status: "unpaid" }),
        ),
      PlatformCheckoutNotCompleteError,
    );
  });

  it("accepts paid subscription checkout", () => {
    assert.doesNotThrow(() =>
      assertPlatformCheckoutSessionComplete(session()),
    );
  });

  it("accepts no_payment_required for trial-style checkout", () => {
    assert.doesNotThrow(() =>
      assertPlatformCheckoutSessionComplete(
        session({ payment_status: "no_payment_required" }),
      ),
    );
  });

  it("accepts expanded subscription objects", () => {
    assert.doesNotThrow(() =>
      assertPlatformCheckoutSessionComplete(
        session({ subscription: { id: "sub_expanded" } }),
      ),
    );
  });
});
