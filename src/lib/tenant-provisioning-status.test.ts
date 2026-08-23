import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantProvisioningStatus,
  type TenantProvisioningInput,
} from "./tenant-provisioning-status";

function baseInput(
  overrides: Partial<TenantProvisioningInput> = {},
): TenantProvisioningInput {
  return {
    organizationId: "00000000-0000-4000-8000-000000000001",
    organizationName: "Test SuperValu",
    assistantDisplayName: "Cara",
    greeting: "",
    customPrompt: "",
    phoneNumber: "",
    poolPhoneE164: null,
    poolPhoneAssigned: false,
    callRoutingMode: "cliste_number",
    fallbackNumber: "",
    storePublicNumber: "",
    divertCarrier: "",
    businessHours: null,
    agentServicesDepartments: [],
    agentFaqs: [],
    ownerUserId: null,
    ownerHasLegalAcceptances: false,
    inviteSentAt: "2026-01-01T00:00:00.000Z",
    inviteAcceptedAt: null,
    hasInboundCallLog: false,
    caraOnlineSince: null,
    ...overrides,
  };
}

const compliantGreeting =
  "You're through to Test SuperValu — I'm Cara, the AI assistant. This call may be recorded and transcribed. How can I help?";

describe("buildTenantProvisioningStatus stages", () => {
  it("starts in invited when invite not accepted", () => {
    const status = buildTenantProvisioningStatus(baseInput());
    assert.equal(status.stage, "invited");
  });

  it("moves to configuring after invite accepted", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({ inviteAcceptedAt: "2026-01-02T00:00:00.000Z" }),
    );
    assert.equal(status.stage, "configuring");
  });

  it("moves to ready when all go-live steps complete", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({
        inviteAcceptedAt: "2026-01-02T00:00:00.000Z",
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
        storePublicNumber: "+353749876543",
        divertCarrier: "vodafone",
        fallbackNumber: "+353851111111",
        greeting: compliantGreeting,
        businessHours: {
          monday: { open: true, start: "09:00", end: "18:00" },
          _bankHolidaysConfigured: true,
          _bankHolidaysOpen: false,
          _bankHolidaysStart: "10:00",
          _bankHolidaysEnd: "14:00",
        },
        agentServicesDepartments: ["Customer service", "Deli counter"],
        agentFaqs: [{ q: "Hours?", a: "9–6" }],
        customPrompt: "compiled prompt",
        ownerUserId: "user-1",
        ownerHasLegalAcceptances: true,
      }),
    );
    assert.equal(status.stage, "ready");
    assert.equal(status.readyForGoLive, true);
  });

  it("moves to live when cara_online_since is set", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({
        inviteAcceptedAt: "2026-01-02T00:00:00.000Z",
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
        storePublicNumber: "+353749876543",
        divertCarrier: "vodafone",
        fallbackNumber: "+353851111111",
        greeting: compliantGreeting,
        businessHours: {
          monday: { open: true, start: "09:00", end: "18:00" },
          _bankHolidaysConfigured: true,
          _bankHolidaysOpen: false,
          _bankHolidaysStart: "10:00",
          _bankHolidaysEnd: "14:00",
        },
        agentServicesDepartments: ["Customer service"],
        agentFaqs: [{ q: "Hours?", a: "9–6" }],
        customPrompt: "compiled prompt",
        ownerUserId: "user-1",
        ownerHasLegalAcceptances: true,
        caraOnlineSince: "2026-01-10T00:00:00.000Z",
      }),
    );
    assert.equal(status.stage, "live");
  });
});

describe("phone_assigned", () => {
  it("requires org cache and matching assigned pool row", () => {
    const missingPool = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneAssigned: false,
      }),
    );
    assert.equal(
      missingPool.steps.find((s) => s.id === "phone_assigned")?.complete,
      false,
    );

    const mismatch = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353870000000",
        poolPhoneAssigned: true,
      }),
    );
    assert.equal(
      mismatch.steps.find((s) => s.id === "phone_assigned")?.complete,
      false,
    );

    const ok = buildTenantProvisioningStatus(
      baseInput({
        phoneNumber: "+353871234567",
        poolPhoneE164: "+353871234567",
        poolPhoneAssigned: true,
      }),
    );
    assert.equal(
      ok.steps.find((s) => s.id === "phone_assigned")?.complete,
      true,
    );
  });
});

describe("routing_configured transfer-number conditional", () => {
  it("requires fallback for cliste_number mode", () => {
    const withoutFallback = buildTenantProvisioningStatus(
      baseInput({
        callRoutingMode: "cliste_number",
        storePublicNumber: "+353749876543",
        divertCarrier: "vodafone",
        fallbackNumber: "",
      }),
    );
    assert.equal(
      withoutFallback.steps.find((s) => s.id === "routing_configured")
        ?.complete,
      false,
    );

    const withFallback = buildTenantProvisioningStatus(
      baseInput({
        callRoutingMode: "cliste_number",
        storePublicNumber: "+353749876543",
        divertCarrier: "vodafone",
        fallbackNumber: "+353851111111",
      }),
    );
    assert.equal(
      withFallback.steps.find((s) => s.id === "routing_configured")?.complete,
      true,
    );
  });

  it("does not require fallback for forward_all mode", () => {
    const status = buildTenantProvisioningStatus(
      baseInput({
        callRoutingMode: "forward_all",
        storePublicNumber: "+353749876543",
        divertCarrier: "vodafone",
        fallbackNumber: "",
      }),
    );
    assert.equal(
      status.steps.find((s) => s.id === "routing_configured")?.complete,
      true,
    );
  });
});
