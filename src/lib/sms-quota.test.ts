import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCallerFacingSmsPurpose,
  sumCallerFacingSmsSegments,
} from "./sms-quota-helpers";

describe("isCallerFacingSmsPurpose", () => {
  it("excludes owner alert purposes from caller quota", () => {
    assert.equal(isCallerFacingSmsPurpose("action_inbox_notify"), false);
    assert.equal(isCallerFacingSmsPurpose("cara_training_notify"), false);
  });

  it("counts customer-facing purposes", () => {
    assert.equal(isCallerFacingSmsPurpose("staff_text_back"), true);
    assert.equal(isCallerFacingSmsPurpose("caller_outbound"), true);
  });
});

describe("sumCallerFacingSmsSegments", () => {
  it("ignores internal notification rows", () => {
    assert.equal(
      sumCallerFacingSmsSegments([
        { purpose: "action_inbox_notify", segments: 47 },
        { purpose: "cara_training_notify", segments: 23 },
        { purpose: "staff_text_back", segments: 2 },
      ]),
      2,
    );
  });
});
