import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTransferCapability } from "./transfer-capability";
import { canStoreTransfer } from "./store-transfer-capability";
import { storeDepartmentsPromptSection } from "./store-departments-prompt";

const capablePhone = {
  transfer_method: "sip_refer" as const,
  warm_transfer_hardware_status: "go" as const,
  transfer_verified_at: "2026-08-01T12:00:00Z",
  has_ddi_range: true,
};

const dept = {
  id: "d1",
  name: "Deli counter",
  active: true,
  extension: "102",
  direct_dial_e164: "+35311223344",
  phone_e164: null,
  cara_note: null,
  handles_text: "Hot food and deli orders",
  is_off_licence: false,
  is_an_post: false,
};

function capability(overrides: Partial<Parameters<typeof resolveTransferCapability>[0]> = {}) {
  return resolveTransferCapability({
    callRoutingMode: "cliste_number",
    phoneSystem: capablePhone,
    departments: [dept],
    ...overrides,
  });
}

describe("canStoreTransfer", () => {
  it("is false when routing mode is forward_all", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "go",
        transferMethod: "sip_refer",
        callRoutingMode: "forward_all",
        transferVerifiedAt: "2026-08-01T12:00:00Z",
      }),
      false,
    );
  });

  it("is false when transfer method is none", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "go",
        transferMethod: "none",
        callRoutingMode: "cliste_number",
        transferVerifiedAt: "2026-08-01T12:00:00Z",
      }),
      false,
    );
  });

  it("is false when hardware status is not go", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "pending",
        transferMethod: "sip_refer",
        callRoutingMode: "cliste_number",
        transferVerifiedAt: "2026-08-01T12:00:00Z",
      }),
      false,
    );
  });

  it("is false when not verified", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "go",
        transferMethod: "sip_refer",
        callRoutingMode: "cliste_number",
      }),
      false,
    );
  });

  it("is true when all gates pass", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "go",
        transferMethod: "sip_refer",
        callRoutingMode: "cliste_number",
        transferVerifiedAt: "2026-08-01T12:00:00Z",
      }),
      true,
    );
  });
});

describe("storeDepartmentsPromptSection", () => {
  it("never promises transfer when capability blocks store", () => {
    const section = storeDepartmentsPromptSection({
      capability: capability({
        phoneSystem: { ...capablePhone, transfer_verified_at: null },
      }),
      departments: [dept],
    });
    assert.match(section, /take their name, number, and what they need/i);
    assert.doesNotMatch(section, /put you through/i);
    assert.doesNotMatch(section, /102/);
    assert.doesNotMatch(section, /\+353/);
  });

  it("allows transfer language when department can transfer", () => {
    const section = storeDepartmentsPromptSection({
      capability: capability(),
      departments: [dept],
    });
    assert.match(section, /put you through/i);
    assert.doesNotMatch(section, /102/);
    assert.doesNotMatch(section, /\+353/);
  });
});
