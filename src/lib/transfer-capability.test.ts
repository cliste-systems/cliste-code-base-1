import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTransferCapability } from "./transfer-capability";

const capablePhone = {
  transfer_method: "sip_refer" as const,
  warm_transfer_hardware_status: "go" as const,
  transfer_verified_at: "2026-08-01T12:00:00Z",
  has_ddi_range: true,
};

const dept = (overrides: Partial<Parameters<typeof resolveTransferCapability>[0]["departments"][0]> = {}) => ({
  id: "d1",
  name: "Bakery",
  active: true,
  extension: null,
  direct_dial_e164: "+35311223344",
  phone_e164: null,
  ...overrides,
});

describe("resolveTransferCapability", () => {
  it("blocks when routing mode would loop even if hardware is go and verified", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "forward_all",
      phoneSystem: capablePhone,
      departments: [dept()],
    });
    assert.ok(cap.blockers.includes("routing_mode_would_loop"));
    assert.equal(cap.canTransfer, false);
    assert.equal(cap.fallbackBehaviour, "take_message");
  });

  it("blocks store transfer when DDI on dept but store blocked", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: { ...capablePhone, transfer_verified_at: null },
      departments: [dept()],
    });
    assert.ok(cap.blockers.includes("not_verified"));
    assert.equal(cap.canTransfer, false);
    assert.equal(cap.perDepartment.d1!.canTransfer, false);
  });

  it("extension-only department messages while others transfer in capable store", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: capablePhone,
      departments: [
        dept({ id: "d1", name: "Bakery", direct_dial_e164: "+35311223344" }),
        dept({
          id: "d2",
          name: "Deli",
          extension: "203",
          direct_dial_e164: null,
        }),
      ],
    });
    assert.equal(cap.canTransfer, true);
    assert.equal(cap.perDepartment.d1!.canTransfer, true);
    assert.equal(cap.perDepartment.d1!.target, "+35311223344");
    assert.equal(cap.perDepartment.d2!.canTransfer, false);
    assert.equal(cap.perDepartment.d2!.target, null);
  });

  it("surfaces ddi_range_unknown when has_ddi_range is null", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: { ...capablePhone, has_ddi_range: null },
      departments: [dept()],
    });
    assert.ok(cap.blockers.includes("ddi_range_unknown"));
    assert.equal(cap.canTransfer, false);
  });

  it("blocks transfers when has_ddi_range is false", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: { ...capablePhone, has_ddi_range: false },
      departments: [dept()],
    });
    assert.ok(cap.blockers.includes("no_ddi_range"));
    assert.equal(cap.fallbackBehaviour, "take_message");
  });

  it("never uses extension as transfer target", () => {
    const cap = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: capablePhone,
      departments: [
        dept({ extension: "101", direct_dial_e164: null, phone_e164: null }),
      ],
    });
    assert.equal(cap.perDepartment.d1!.target, null);
    assert.equal(cap.perDepartment.d1!.canTransfer, false);
  });
});
