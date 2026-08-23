import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminCaraTrainingReadinessDetail,
  adminCaraTrainingSectionChecks,
  isAdminCaraTrainingComplete,
  type AdminCaraTrainingReadinessInput,
} from "./admin-cara-training-readiness";

const compliantGreeting =
  "You're through to Test SuperValu — I'm Cara, the AI assistant. This call may be recorded and transcribed. How can I help?";

function baseInput(
  overrides: Partial<AdminCaraTrainingReadinessInput> = {},
): AdminCaraTrainingReadinessInput {
  return {
    assistantDisplayName: "Cara",
    agentVoiceId: "",
    greeting: "",
    greetingIntro: "",
    greetingClosing: "",
    agentBusinessType: "",
    businessKnowledgeSummary: "",
    departments: [],
    agentServicesNotOffered: "",
    agentExtraNotes: "",
    businessHours: null,
    agentFaqs: [],
    agentDetailsToCollect: "",
    phoneSystem: null,
    canTransfer: false,
    customPrompt: "",
    promptCompileWarnings: [],
    ...overrides,
  };
}

describe("isAdminCaraTrainingComplete", () => {
  it("is false when any section is missing", () => {
    assert.equal(isAdminCaraTrainingComplete(baseInput()), false);
  });

  it("is true when all required sections are saved", () => {
    assert.equal(
      isAdminCaraTrainingComplete(
        baseInput({
          agentVoiceId: "voice-123",
          greeting: compliantGreeting,
          agentBusinessType: "Supermarket",
          businessKnowledgeSummary: "Local SuperValu store.",
          departments: [{ name: "Customer service", active: true }],
          agentServicesNotOffered: "No home delivery",
          agentExtraNotes: "Escalate complaints to manager.",
          agentFaqs: [
            { question: "Hours?", answer: "See opening hours." },
            { question: "Parking?", answer: "Free car park." },
            { question: "Returns?", answer: "Receipt required." },
          ],
          agentDetailsToCollect: "Name, callback number",
          phoneSystem: {
            organization_id: "org-1",
            system_type: "pbx",
            vendor: "Avaya",
            handset_count: 12,
            transfer_method: "sip_refer",
            warm_transfer_hardware_status: "go",
            transfer_verified_at: null,
            main_line_e164: null,
            notes: null,
          },
          quotePricesOnCalls: false,
          businessHours: {
            monday: { open: true, start: "09:00", end: "18:00" },
            _bankHolidaysConfigured: true,
            _bankHolidaysOpen: false,
            _bankHolidaysStart: "10:00",
            _bankHolidaysEnd: "14:00",
          },
          customPrompt: "compiled prompt body",
        }),
      ),
      true,
    );
  });

  it("accepts legacy comma-separated departments for provisioning", () => {
    assert.equal(
      isAdminCaraTrainingComplete(
        baseInput({
          agentVoiceId: "voice-123",
          greeting: compliantGreeting,
          agentBusinessType: "Supermarket",
          businessKnowledgeSummary: "Local SuperValu store.",
          legacyDepartments: "Customer service, Deli counter",
          agentServicesNotOffered: "No home delivery",
          agentExtraNotes: "Escalate complaints to manager.",
          agentFaqs: [
            { question: "Hours?", answer: "See opening hours." },
            { question: "Parking?", answer: "Free car park." },
            { question: "Returns?", answer: "Receipt required." },
          ],
          agentDetailsToCollect: "Name, callback number",
          phoneSystem: {
            organization_id: "org-1",
            system_type: "pbx",
            vendor: null,
            handset_count: null,
            transfer_method: "none",
            warm_transfer_hardware_status: "pending",
            transfer_verified_at: null,
            main_line_e164: null,
            notes: null,
          },
          quotePricesOnCalls: true,
          businessHours: {
            monday: { open: true, start: "09:00", end: "18:00" },
            _bankHolidaysConfigured: true,
          },
          customPrompt: "compiled prompt body",
        }),
      ),
      true,
    );
  });

  it("reports incomplete detail text", () => {
    const result = adminCaraTrainingReadinessDetail(baseInput());
    assert.equal(result.complete, false);
    assert.match(result.detail, /Incomplete/i);
  });
});

describe("adminCaraTrainingSectionChecks", () => {
  it("marks phone system incomplete when hardware status is unknown", () => {
    const checks = adminCaraTrainingSectionChecks(
      baseInput({
        phoneSystem: {
          organization_id: "org-1",
          system_type: "unknown",
          vendor: null,
          handset_count: null,
          transfer_method: "none",
          warm_transfer_hardware_status: "unknown",
          transfer_verified_at: null,
          main_line_e164: null,
          notes: null,
        },
      }),
    );
    const phone = checks.find((c) => c.id === "phoneSystem");
    assert.equal(phone?.complete, false);
  });
});
