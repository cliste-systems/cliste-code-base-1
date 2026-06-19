import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyActionCategory,
} from "./categories";
import {
  parseStructuredCaptureSummary,
} from "./action-inbox-helpers";

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
});
