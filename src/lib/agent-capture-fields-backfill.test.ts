import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  backfillCaptureFieldsForOrg,
  isCorruptCaptureFields,
  resolveCaptureFieldsForOrg,
} from "./agent-capture-fields-backfill";

describe("agent-capture-fields-backfill", () => {
  it("flags comma-split corrupt capture rows", () => {
    const corrupt = [
      { id: "name", label: "Name" },
      { id: "custom_name", label: "name" },
      { id: "phone", label: "Phone number" },
      {
        id: "custom_and_their_preferred_day_or_stylist",
        label: "and their preferred day or stylist.",
      },
    ];

    assert.equal(isCorruptCaptureFields(corrupt), true);
  });

  it("backfills corrupt salon rows to clean defaults", () => {
    const corrupt = [
      { id: "name", label: "Name" },
      { id: "custom_name", label: "name" },
      { id: "phone", label: "Phone number" },
      {
        id: "custom_and_their_preferred_day_or_stylist",
        label: "and their preferred day or stylist.",
      },
    ];

    const result = backfillCaptureFieldsForOrg({
      rawFields: corrupt,
      detailsText:
        "Name, phone number, the service they want, and their preferred day or stylist.",
      businessType: "Hair salon",
      niche: "hair_salon",
    });

    assert.equal(result.wasCorrupt, true);
    assert.deepEqual(
      result.fields.map((field) => field.id),
      ["name", "phone", "preferred_service", "preferred_day"],
    );
    assert.match(result.detailsText, /preferred service/);
    assert.doesNotMatch(result.detailsText, /and their/);
  });

  it("preserves clean structured fields on load", () => {
    const clean = [
      { id: "name", label: "Name" },
      { id: "phone", label: "Phone number" },
      { id: "preferred_service", label: "Preferred service" },
      { id: "preferred_day", label: "Preferred day" },
    ];

    const resolved = resolveCaptureFieldsForOrg({
      rawFields: clean,
      businessType: "Hair salon",
      niche: "hair_salon",
    });

    assert.deepEqual(
      resolved.map(({ id, label }) => ({ id, label })),
      clean,
    );
  });

  it("uses faq-only defaults when corrupt and goal is faq_only", () => {
    const result = backfillCaptureFieldsForOrg({
      rawFields: [
        { id: "name", label: "Name" },
        { id: "custom_and_their_preferred_day_or_stylist", label: "and their preferred day or stylist." },
      ],
      businessType: "Hair salon",
      niche: "hair_salon",
      caraGoal: "faq_only",
    });

    assert.deepEqual(
      result.fields.map((field) => field.id),
      ["name", "phone", "what_they_need", "callback_time"],
    );
  });
});
