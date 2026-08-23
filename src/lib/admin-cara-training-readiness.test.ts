import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminCaraTrainingReadinessDetail,
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
    agentBusinessType: "",
    businessKnowledgeSummary: "",
    agentServicesDepartments: "",
    agentServicesNotOffered: "",
    agentExtraNotes: "",
    businessHours: null,
    customPrompt: "",
    promptCompileWarnings: [],
    ...overrides,
  };
}

describe("isAdminCaraTrainingComplete", () => {
  it("is false when any section is missing", () => {
    assert.equal(isAdminCaraTrainingComplete(baseInput()), false);
  });

  it("is true when greeting, knowledge, hours, and prompt are saved", () => {
    assert.equal(
      isAdminCaraTrainingComplete(
        baseInput({
          agentVoiceId: "voice-123",
          greeting: compliantGreeting,
          agentBusinessType: "Supermarket",
          businessKnowledgeSummary: "Local SuperValu store.",
          agentServicesDepartments: "Customer service, Deli counter",
          agentServicesNotOffered: "No home delivery",
          agentExtraNotes: "Escalate complaints to manager.",
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

  it("reports incomplete detail text", () => {
    const result = adminCaraTrainingReadinessDetail(baseInput());
    assert.equal(result.complete, false);
    assert.match(result.detail, /Cara training/i);
  });
});
