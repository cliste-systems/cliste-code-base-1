import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_DEMO_CALL_LINE_PRESETS,
  ADMIN_SIM_CALLER_E164,
  isAllowedAdminDemoCalledNumber,
  KAVANAGHS_DEMO_LINE_E164,
  normalizeAdminDemoCalledNumber,
} from "./admin-demo-call-lines";
import {
  INTERNAL_QA_LINE_E164,
  TEST_LINE_E164,
} from "./call-testing-types";

describe("admin-demo-call-lines", () => {
  it("allowlists the three demo lines", () => {
    assert.equal(ADMIN_DEMO_CALL_LINE_PRESETS.length, 3);
    assert.equal(isAllowedAdminDemoCalledNumber(TEST_LINE_E164), true);
    assert.equal(isAllowedAdminDemoCalledNumber(KAVANAGHS_DEMO_LINE_E164), true);
    assert.equal(isAllowedAdminDemoCalledNumber(INTERNAL_QA_LINE_E164), true);
    assert.equal(isAllowedAdminDemoCalledNumber("+15551234567"), false);
  });

  it("normalizes allowlisted numbers", () => {
    assert.equal(normalizeAdminDemoCalledNumber(` ${KAVANAGHS_DEMO_LINE_E164} `), KAVANAGHS_DEMO_LINE_E164);
    assert.equal(normalizeAdminDemoCalledNumber("+15551234567"), null);
  });

  it("uses a fixed Irish mobile for simulated caller id", () => {
    assert.match(ADMIN_SIM_CALLER_E164, /^\+35387/);
  });
});
