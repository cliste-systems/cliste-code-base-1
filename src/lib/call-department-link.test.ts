import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callDepartmentButtonLabel,
  resolveCallDepartmentLink,
} from "./call-department-link";

describe("resolveCallDepartmentLink", () => {
  it("returns bakery link for bakery order summaries", () => {
    const link = resolveCallDepartmentLink({
      aiSummary:
        "Mark called to order a birthday cake for 7 people. Details captured for the bakery team.",
    });

    assert.ok(link);
    assert.equal(link.slug, "bakery");
    assert.equal(link.buttonLabel, "Open in Bakery");
    assert.equal(link.href, "/dashboard/departments/bakery");
  });

  it("returns null for general enquiries", () => {
    const link = resolveCallDepartmentLink({
      aiSummary: "Caller asked what time the shop closes today.",
    });

    assert.equal(link, null);
  });

  it("links to the ticket when one exists", () => {
    const link = resolveCallDepartmentLink({
      aiSummary: "Birthday cake order.",
      followUpSummary: "Birthday cake order for Saturday.",
      followUpTicketId: "ticket-123",
    });

    assert.ok(link);
    assert.equal(link.href, "/dashboard/departments/bakery?ticket=ticket-123");
  });

  it("routes meat counter enquiries", () => {
    const link = resolveCallDepartmentLink({
      aiSummary: "Caller asked about striploin steak at the butcher counter.",
    });

    assert.ok(link);
    assert.equal(link.slug, "meat-counter");
    assert.equal(link.buttonLabel, "Open in Meat counter");
  });
});

describe("callDepartmentButtonLabel", () => {
  it("uses the short department label", () => {
    assert.equal(callDepartmentButtonLabel("deli"), "Open in Deli");
  });
});
