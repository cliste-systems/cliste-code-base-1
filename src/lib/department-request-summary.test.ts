import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  departmentRequestTypeLabel,
  filterDepartmentRequestFieldsForDisplay,
  formatDepartmentListPreview,
  parseDepartmentRequestSummary,
  personNamesMatch,
} from "./department-request-summary";

describe("parseDepartmentRequestSummary", () => {
  it("parses a single birthday cake order into scannable fields", () => {
    const parsed = parseDepartmentRequestSummary(
      "Birthday cake for Brendan for Monday the 14th. Message: 'Happy Birthday Brendan' with pink icing around the side. [route: retail-bakery-cake]",
    );

    assert.ok(parsed);
    assert.equal(parsed!.header, "Birthday cake order");
    assert.deepEqual(
      parsed!.fields.map((field) => [field.label, field.value]),
      [
        ["For", "Brendan"],
        ["Date", "Monday the 14th"],
        ["Message", "Happy Birthday Brendan"],
        ["Notes", "pink icing around the side"],
      ],
    );
  });

  it("parses multiple cake orders on one ticket", () => {
    const parsed = parseDepartmentRequestSummary(
      "Two cake orders for Monday the 14th: 1. For Sean, message 'Happy 17th Birthday, Sean'. 2. For Mary, message 'Happy 50th Birthday, Mary'.",
    );

    assert.ok(parsed);
    assert.equal(parsed!.header, "Birthday cake orders");
    assert.equal(parsed!.fields[0]?.label, "Date");
    assert.match(parsed!.fields[1]?.value ?? "", /Sean/);
    assert.match(parsed!.fields[2]?.value ?? "", /Mary/);
  });

  it("parses butcher requests into order and timing fields", () => {
    const parsed = parseDepartmentRequestSummary(
      "Customer wants the butcher to cut 10 sirloin steaks to be ready for collection after work.",
    );

    assert.ok(parsed);
    assert.equal(parsed!.header, "Butcher request");
    assert.equal(parsed!.fields[0]?.label, "Order");
    assert.equal(parsed!.fields[0]?.value, "10 sirloin steaks");
    assert.equal(parsed!.fields[1]?.label, "When");
    assert.equal(parsed!.fields[1]?.value, "collection after work");
  });

  it("shows request type in list previews, not order contents", () => {
    const butcherPreview = formatDepartmentListPreview(
      parseDepartmentRequestSummary(
        "Customer wants the butcher to cut 10 sirloin steaks to be ready for collection after work.",
      )!,
    );
    assert.equal(butcherPreview, "Order");
    assert.doesNotMatch(butcherPreview, /sirloin/i);

    const cakePreview = formatDepartmentListPreview(
      parseDepartmentRequestSummary(
        "Birthday cake for Brendan for Monday the 14th. Message: 'Happy Birthday Brendan' with pink icing around the side.",
      )!,
    );
    assert.equal(cakePreview, "Order");
    assert.doesNotMatch(cakePreview, /Brendan/);
  });

  it("drops collecting when it matches the caller name", () => {
    const fields = filterDepartmentRequestFieldsForDisplay(
      [
        { label: "Order", value: "Birthday cake", unconfirmed: false },
        { label: "For", value: "Sean", unconfirmed: false },
        { label: "Collecting", value: "Stephen", unconfirmed: false },
        { label: "Message", value: "Happy Birthday Sean", unconfirmed: false },
      ],
      "Stephen",
    );

    assert.deepEqual(
      fields.map((field) => field.label),
      ["Order", "For", "Message"],
    );
    assert.ok(personNamesMatch("Stephen", "Stephen"));
    assert.ok(!personNamesMatch("Stephen", "Mary"));
  });
});
