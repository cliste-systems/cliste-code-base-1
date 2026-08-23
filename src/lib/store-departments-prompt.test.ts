import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canStoreTransfer } from "./store-transfer-capability";
import { storeDepartmentsPromptSection } from "./store-departments-prompt";

const dept = {
  name: "Deli counter",
  active: true,
  transfer_enabled: true,
  extension: "102",
  phone_e164: null,
  cara_note: null,
  handles_text: "Hot food and deli orders",
  is_off_licence: false,
  is_an_post: false,
};

describe("canStoreTransfer", () => {
  it("is false when routing mode is forward_all", () => {
    assert.equal(
      canStoreTransfer({
        warmTransferHardwareStatus: "go",
        transferMethod: "sip_refer",
        callRoutingMode: "forward_all",
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
      }),
      true,
    );
  });
});

describe("storeDepartmentsPromptSection", () => {
  it("never promises transfer when canTransfer is false", () => {
    const section = storeDepartmentsPromptSection({
      canTransfer: false,
      departments: [dept],
    });
    assert.match(section, /take their name, number, and what they need/i);
    assert.doesNotMatch(section, /put them through/i);
  });

  it("allows transfer language when canTransfer is true", () => {
    const section = storeDepartmentsPromptSection({
      canTransfer: true,
      departments: [dept],
    });
    assert.match(section, /try to put them through/i);
    assert.match(section, /102/);
  });
});
