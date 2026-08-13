import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blockedCallDashboardSummary,
  blockedCallSpokenMessage,
} from "./blocked-call-copy";

describe("blocked-call-copy", () => {
  it("includes the business name in dashboard summary", () => {
    const text = blockedCallDashboardSummary("Bloom Beauty Studio");
    assert.match(text, /Bloom Beauty Studio/);
    assert.match(text, /blocklist/i);
  });

  it("includes business name and Hello Cara in spoken message", () => {
    const text = blockedCallSpokenMessage("Bloom Beauty Studio");
    assert.match(text, /Bloom Beauty Studio/);
    assert.match(text, /Hello Cara/i);
    assert.match(text, /Goodbye/i);
  });

  it("falls back when business name is empty", () => {
    assert.match(blockedCallDashboardSummary(""), /your business/);
    assert.match(blockedCallSpokenMessage(""), /this business/);
  });
});
