import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileCaraPromptWithMeta } from "./compile-cara-prompt";
import { resolveTransferCapability } from "./transfer-capability";
import { storeDepartmentsPromptSection } from "./store-departments-prompt";

const dept = {
  id: "d1",
  name: "Customer service",
  active: true,
  extension: "101",
  direct_dial_e164: "+353871234567",
  phone_e164: "+353871234567",
  cara_note: null,
  handles_text: null,
  is_off_licence: false,
  is_an_post: false,
};

describe("admin notes prompt boundary", () => {
  it("never includes adminNotes in compiled output", () => {
    const secret = "[INTERNAL] Do not tell callers about the broken deli phone.";
    const capability = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: {
        transfer_method: "none",
        warm_transfer_hardware_status: "unknown",
        has_ddi_range: false,
      },
      departments: [dept],
    });
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Test Store",
      businessType: "Supermarket",
      assistantDisplayName: "Cara",
      servicesOffered: "Customer service",
      servicesNotOffered: "Delivery",
      anythingElse: "General store info.",
      adminNotes: secret,
      canTransfer: false,
      storeDepartmentsSection: storeDepartmentsPromptSection({
        capability,
        departments: [dept],
      }),
    });
    assert.ok(!prompt.includes(secret));
    assert.ok(!prompt.includes("adminNotes"));
  });
});

describe("staff contact GDPR boundary", () => {
  it("does not emit staff phone numbers or extensions in department prompt", () => {
    const capability = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: {
        transfer_method: "none",
        warm_transfer_hardware_status: "unknown",
        has_ddi_range: false,
      },
      departments: [dept],
    });
    const section = storeDepartmentsPromptSection({
      capability,
      departments: [dept],
    });
    assert.ok(!section.includes("+353871234567"));
    assert.ok(!section.includes("101"));
    assert.match(section, /message/i);
  });

  it("compileCaraPromptWithMeta scan excludes phone system numbers", () => {
    const installer = "installer@pbx.example";
    const capability = resolveTransferCapability({
      callRoutingMode: "cliste_number",
      phoneSystem: {
        transfer_method: "sip_refer",
        warm_transfer_hardware_status: "go",
        transfer_verified_at: "2026-08-01T12:00:00Z",
        has_ddi_range: true,
        installer_contact: installer,
      },
      departments: [dept],
    });
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Test Store",
      businessType: "Supermarket",
      assistantDisplayName: "Cara",
      servicesOffered: "Customer service",
      servicesNotOffered: "Delivery",
      anythingElse: "General store info.",
      canTransfer: capability.canTransfer,
      storeDepartmentsSection: storeDepartmentsPromptSection({
        capability,
        departments: [dept],
      }),
    });
    assert.ok(!prompt.includes("+353871234567"));
    assert.ok(!prompt.includes("101"));
    assert.ok(!prompt.includes(installer));
  });
});
