import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detailLabelsFromCaptureFields,
  syncCaptureFieldsFromDetailLabels,
} from "./sync-capture-fields";

describe("sync-capture-fields", () => {
  it("derives chip labels from structured capture fields", () => {
    const labels = detailLabelsFromCaptureFields([
      { id: "name", label: "Name" },
      { id: "phone", label: "Phone number" },
      { id: "preferred_service", label: "Preferred service" },
    ]);

    assert.deepEqual(labels, ["Name", "Phone number", "Preferred service"]);
  });

  it("preserves field ids when dashboard chips match existing labels", () => {
    const existing = [
      { id: "name", label: "Name" },
      { id: "phone", label: "Phone number" },
      { id: "preferred_service", label: "Preferred service" },
    ];

    const synced = syncCaptureFieldsFromDetailLabels(existing, [
      "Preferred service",
      "Stylist preference",
    ]);

    assert.equal(
      synced.find((field) => field.label === "Preferred service")?.id,
      "preferred_service",
    );
    assert.ok(synced.some((field) => field.label === "Stylist preference"));
    assert.ok(synced.some((field) => field.id === "name"));
    assert.ok(synced.some((field) => field.id === "phone"));
  });
});
