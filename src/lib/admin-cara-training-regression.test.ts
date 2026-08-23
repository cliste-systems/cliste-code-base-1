import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileCaraPromptWithMeta } from "./compile-cara-prompt";
import { storeDepartmentsPromptSection } from "./store-departments-prompt";

describe("admin notes prompt boundary", () => {
  it("never includes adminNotes in compiled output", () => {
    const secret = "[INTERNAL] Do not tell callers about the broken deli phone.";
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
        canTransfer: false,
        departments: [
          {
            name: "Customer service",
            active: true,
            transfer_enabled: false,
            extension: null,
            phone_e164: null,
            cara_note: null,
            handles_text: null,
            is_off_licence: false,
            is_an_post: false,
          },
        ],
      }),
    });
    assert.ok(!prompt.includes(secret));
    assert.ok(!prompt.includes("adminNotes"));
  });
});

describe("staff contact GDPR boundary", () => {
  it("does not emit staff phone numbers in department prompt when transfers disabled", () => {
    const section = storeDepartmentsPromptSection({
      canTransfer: false,
      departments: [
        {
          name: "Manager",
          active: true,
          transfer_enabled: true,
          extension: "101",
          phone_e164: "+353871234567",
          cara_note: null,
          handles_text: null,
          is_off_licence: false,
          is_an_post: false,
        },
      ],
    });
    assert.ok(!section.includes("+353871234567"));
    assert.ok(!section.includes("101"));
    assert.match(section, /message/i);
  });
});
