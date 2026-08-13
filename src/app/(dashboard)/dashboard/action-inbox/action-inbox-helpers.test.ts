import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyActionCategory,
} from "./categories";
import {
  parseStructuredCaptureSummary,
  sortActionInboxItems,
  type ActionInboxItem,
} from "./action-inbox-helpers";

function makeItem(
  partial: Pick<ActionInboxItem, "id" | "category" | "createdAt"> &
    Partial<ActionInboxItem>,
): ActionInboxItem {
  return {
    callerNumber: "+353871234567",
    callerDisplay: "087 123 4567",
    callerName: "Test",
    contactLabel: "Test",
    contactEmail: null,
    summary: "",
    status: "open",
    createdAtLabel: "",
    categoryTitle: "",
    categoryShort: "",
    ...partial,
  };
}

describe("booking inbox presentation", () => {
  it("classifies booking callback header before generic callback", () => {
    const summary = `Booking request — callback needed

Name: Jane Smith
Phone: +353871234567`;

    assert.equal(classifyActionCategory(summary), "booking_request");
  });

  it("parses structured fields with UNCONFIRMED markers", () => {
    const summary = `Booking request — callback needed

Name: Jane Smith
Phone: +353871234567
Preferred service: Balayage (UNCONFIRMED)
Preferred day: Saturday (UNCONFIRMED)`;

    const parsed = parseStructuredCaptureSummary(summary);
    assert.ok(parsed);
    assert.equal(parsed!.header, "Booking request — callback needed");
    assert.equal(parsed!.fields.length, 4);
    assert.equal(parsed!.fields[0]!.unconfirmed, false);
    assert.equal(parsed!.fields[2]!.unconfirmed, true);
    assert.equal(parsed!.fields[2]!.value, "Balayage");
  });

  it("sorts open queue by priority then recency; urgent first, failed last", () => {
    const oldUrgent = makeItem({
      id: "urgent",
      category: "urgent",
      createdAt: "2026-06-20T09:00:00Z",
    });
    const newFollowUp = makeItem({
      id: "follow",
      category: "follow_up",
      createdAt: "2026-06-25T09:00:00Z",
    });
    const newBooking = makeItem({
      id: "booking",
      category: "booking_request",
      createdAt: "2026-06-25T08:00:00Z",
    });
    const failed = makeItem({
      id: "failed",
      category: "failed",
      createdAt: "2026-06-25T10:00:00Z",
    });

    const sorted = sortActionInboxItems([newFollowUp, failed, newBooking, oldUrgent]);
    assert.deepEqual(
      sorted.map((i) => i.id),
      ["urgent", "booking", "follow", "failed"],
    );
  });

  it("orders resolved items by recency only", () => {
    const older = makeItem({
      id: "older",
      category: "urgent",
      createdAt: "2026-06-20T09:00:00Z",
      status: "resolved",
    });
    const newer = makeItem({
      id: "newer",
      category: "follow_up",
      createdAt: "2026-06-25T09:00:00Z",
      status: "resolved",
    });
    const sorted = sortActionInboxItems([older, newer]);
    assert.deepEqual(
      sorted.map((i) => i.id),
      ["newer", "older"],
    );
  });
});
