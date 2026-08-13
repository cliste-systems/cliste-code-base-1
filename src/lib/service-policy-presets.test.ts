import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CaraCapabilities } from "./cara-capabilities";

import {
  compileCallbackOnlyBookingGuidance,
  compilePatchTestBookingGuidance,
  compileServiceCatalogKnowledgeLine,
  catalogHasServicePolicies,
  SERVICE_POLICY_INSTRUCTION,
  sanitizeServiceVoiceNote,
  toggleServicePolicyFlag,
  validateServiceVoiceNote,
} from "./service-policy-presets";

const emptyCaps: CaraCapabilities = {
  book: false,
  transfer: false,
  sendLink: false,
  sendFile: false,
  email: false,
  whatsapp: false,
  takeMessage: true,
};

describe("service policy presets", () => {
  it("compiles multiple policy presets on one service line", () => {
    const line = compileServiceCatalogKnowledgeLine({
      name: "Full colour",
      price: 85,
      durationMinutes: 120,
      policyFlags: [
        { type: "patch_test", hours: 48 },
        { type: "consultation_required" },
      ],
      aiVoiceNotes: null,
    });

    assert.match(line, /patch test is needed 48 hours/i);
    assert.match(line, /consultation first/i);
  });

  it("catalogHasServicePolicies is false when all flags empty", () => {
    assert.equal(
      catalogHasServicePolicies([
        { policyFlags: [] },
        { policyFlags: [] },
      ]),
      false,
    );
    assert.equal(
      catalogHasServicePolicies([
        { policyFlags: [{ type: "over_18" }] },
      ]),
      true,
    );
  });

  it("compiles patch test preset without free text", () => {
    const line = compileServiceCatalogKnowledgeLine({
      name: "Full colour",
      price: 85,
      durationMinutes: 120,
      policyFlags: [{ type: "patch_test", hours: 48 }],
      aiVoiceNotes: null,
    });

    assert.match(
      line,
      /patch test is needed 48 hours before a first colour appointment/i,
    );
    assert.doesNotMatch(line, /About /);
  });

  it("rejects card collection in free note", () => {
    const result = validateServiceVoiceNote("take their card number", emptyCaps);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.block.length > 0);
    }
  });

  it("prevents appointment_only and walk_ins_welcome together", () => {
    const flags = toggleServicePolicyFlag(
      [{ type: "appointment_only" }],
      "walk_ins_welcome",
    );
    assert.equal(
      flags.some((f) => f.type === "appointment_only"),
      false,
    );
    assert.equal(
      flags.some((f) => f.type === "walk_ins_welcome"),
      true,
    );
  });

  it("caps and escapes free notes", () => {
    const sanitized = sanitizeServiceVoiceNote(
      `a "long"\nline ${"x".repeat(300)}`,
    );
    assert.ok(sanitized);
    assert.ok(sanitized!.length <= 200);
    assert.doesNotMatch(sanitized!, /"/);
    assert.doesNotMatch(sanitized!, /\n/);
  });

  it("frames free note as About service knowledge", () => {
    const line = compileServiceCatalogKnowledgeLine({
      name: "Balayage",
      price: 120,
      durationMinutes: 120,
      policyFlags: [],
      aiVoiceNotes: "bring inspiration photos",
    });

    assert.match(line, /About Balayage: bring inspiration photos/);
    assert.doesNotMatch(line, /\(bring inspiration photos\)/);
  });

  it("compiles patch-test booking guidance section", () => {
    const section = compilePatchTestBookingGuidance([
      {
        name: "Root colour",
        policyFlags: [{ type: "patch_test", hours: 48 }],
      },
    ]);
    assert.match(section, /Patch-test services \(Root colour\)/i);
    assert.match(section, /48 hours before colour/i);
    assert.match(section, /patch test and the colour appointment together/i);
    assert.match(section, /both texting the online booking link and a team callback/i);
  });

  it("compiles callback-only booking guidance section", () => {
    const section = compileCallbackOnlyBookingGuidance([
      {
        name: "VIP colour",
        policyFlags: [{ type: "callback_only" }],
      },
    ]);
    assert.match(section, /Callback-only services \(VIP colour\)/i);
    assert.match(section, /Do not offer the online booking link/i);
  });

  it("compiles callback_only on service line", () => {
    const line = compileServiceCatalogKnowledgeLine({
      name: "VIP colour",
      price: 120,
      durationMinutes: 120,
      policyFlags: [{ type: "callback_only" }],
      aiVoiceNotes: null,
    });
    assert.match(line, /don't offer the online booking link/i);
  });

  it("toggles callback_only flag", () => {
    const flags = toggleServicePolicyFlag([], "callback_only");
    assert.equal(flags.some((f) => f.type === "callback_only"), true);
  });
});
