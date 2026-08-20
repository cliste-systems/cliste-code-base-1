import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStoreSetupReadiness } from "./admin-store-readiness";
import type { AdminStoreSetupData } from "./retail-store-types";

function baseData(overrides: Partial<AdminStoreSetupData> = {}): AdminStoreSetupData {
  return {
    organizationId: "00000000-0000-4000-8000-000000000001",
    name: "Test SuperValu",
    slug: "test-supervalu",
    niche: "retail",
    accountId: null,
    storeCode: "",
    retailBanner: "",
    agentLocationAddress: "",
    agentLocationEircode: "",
    agentLocationCounty: "",
    timezone: "Europe/Dublin",
    phoneNumber: "",
    storePublicNumber: "",
    callRoutingMode: "cliste_number",
    fallbackNumber: "",
    divertCarrier: "",
    divertVerifiedAt: null,
    retailFacilities: [],
    retailDelivery: {},
    retailClickCollectUrl: "",
    retailLoyaltyProgram: "",
    quotePricesOnCalls: false,
    greeting: "",
    customPrompt: "",
    promptCompileWarnings: [],
    assistantDisplayName: "Cara",
    agentVoiceId: "",
    isActive: false,
    caraOnlineSince: null,
    businessHours: null,
    agentOpeningHours: "",
    routingLinks: [],
    departments: [],
    contacts: [],
    ...overrides,
  };
}

describe("evaluateStoreSetupReadiness", () => {
  it("marks identity incomplete without store code", () => {
    const steps = evaluateStoreSetupReadiness(baseData());
    const identity = steps.find((s) => s.id === "identity");
    assert.equal(identity?.complete, false);
  });

  it("marks identity complete with required fields", () => {
    const steps = evaluateStoreSetupReadiness(
      baseData({
        storeCode: "1234",
        retailBanner: "supervalu",
        agentLocationAddress: "Main St",
        agentLocationEircode: "V93 X7P2",
      }),
    );
    assert.equal(steps.find((s) => s.id === "identity")?.complete, true);
  });
});
