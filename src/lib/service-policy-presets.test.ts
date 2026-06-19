import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CaraCapabilities } from "./cara-capabilities";

import {
  compileServiceCatalogKnowledgeLine,
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
});
