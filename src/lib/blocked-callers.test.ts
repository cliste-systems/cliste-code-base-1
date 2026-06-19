import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANONYMOUS_CALLER_E164,
  isCallerBlocked,
  isOrgProtectedPhone,
  normalizeBlockedCallerE164,
  shouldRunCallCompleteSideEffects,
} from "./blocked-callers";

describe("blocked-callers", () => {
  it("normalizes Irish local numbers to E.164", () => {
    assert.equal(normalizeBlockedCallerE164("087 123 4567"), "+353871234567");
  });

  it("rejects +anonymous for manual blocklist rows", () => {
    assert.equal(normalizeBlockedCallerE164(ANONYMOUS_CALLER_E164), null);
  });

  it("blocks listed numbers", () => {
    assert.equal(
      isCallerBlocked({
        callerE164: "+353871234567",
        blockAnonymous: false,
        blockedNumbers: ["+353871234567"],
      }),
      true,
    );
  });

  it("blocks anonymous only when org toggle is on", () => {
    assert.equal(
      isCallerBlocked({
        callerE164: ANONYMOUS_CALLER_E164,
        blockAnonymous: false,
        blockedNumbers: [],
      }),
      false,
    );
    assert.equal(
      isCallerBlocked({
        callerE164: ANONYMOUS_CALLER_E164,
        blockAnonymous: true,
        blockedNumbers: [],
      }),
      true,
    );
  });

  it("detects org-owned numbers for self-block guard", () => {
    assert.equal(
      isOrgProtectedPhone({
        callerE164: "+353871234567",
        orgPhone: "+353 87 123 4567",
        transferPhone: null,
        assignedDids: [],
      }),
      true,
    );
    assert.equal(
      isOrgProtectedPhone({
        callerE164: "+353879999999",
        orgPhone: "+353871234567",
        transferPhone: "+353879999999",
        assignedDids: [],
      }),
      true,
    );
  });

  it("skips call-complete side effects for blocked outcome", () => {
    assert.equal(shouldRunCallCompleteSideEffects("blocked"), false);
    assert.equal(shouldRunCallCompleteSideEffects("answered"), true);
  });
});
