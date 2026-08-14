import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStoreHealth } from "./admin-store-health";
import { storeDepartmentsPromptSection } from "./store-departments";
import { defaultWeekSchedule } from "./business-hours";

describe("evaluateStoreHealth", () => {
  it("is Go only when DID, cliste_number routing, transfer, and hardware are ready", () => {
    const ready = evaluateStoreHealth({
      phoneNumber: "+353749123456",
      hoursConfigured: true,
      faqCount: 2,
      departmentCount: 3,
      transferNumber: "+353749000000",
      callRoutingMode: "cliste_number",
      hardwareStatus: "go",
      openLearnableGaps: 1,
      lastCallAt: "2026-08-14T12:00:00.000Z",
    });
    assert.equal(ready.warmTransfer.ready, true);
    assert.equal(ready.warmTransfer.label, "Go");
    assert.equal(ready.readyCount, 7);

    const blocked = evaluateStoreHealth({
      phoneNumber: null,
      hoursConfigured: false,
      faqCount: 0,
      departmentCount: 0,
      transferNumber: "",
      callRoutingMode: "forward_all",
      hardwareStatus: "unknown",
      openLearnableGaps: 0,
      lastCallAt: null,
    });
    assert.equal(blocked.warmTransfer.ready, false);
    assert.equal(blocked.warmTransfer.label, "No-go");
    assert.ok(blocked.warmTransfer.reasons.length >= 3);
  });
});

describe("storeDepartmentsPromptSection", () => {
  it("names departments and adds Off-licence / An Post rules when flagged", () => {
    const text = storeDepartmentsPromptSection([
      {
        name: "Deli",
        usesStoreHours: true,
        hours: null,
        transferNumber: "",
        isOffLicence: false,
        isAnPost: false,
      },
      {
        name: "Off-licence",
        usesStoreHours: false,
        hours: {
          ...defaultWeekSchedule(),
          sunday: { open: false, start: "09:00", end: "17:30" },
        },
        transferNumber: "+353749111111",
        isOffLicence: true,
        isAnPost: false,
      },
      {
        name: "An Post",
        usesStoreHours: true,
        hours: null,
        transferNumber: "",
        isOffLicence: false,
        isAnPost: true,
      },
    ]);
    assert.match(text, /Deli/);
    assert.match(text, /Off-licence/);
    assert.match(text, /An Post/);
    assert.match(text, /never sell or promise alcohol/i);
    assert.match(text, /never guess tracking/i);
    assert.match(text, /\+353749111111/);
  });
});
