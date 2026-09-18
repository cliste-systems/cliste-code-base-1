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

  it("routes general follow-ups to Management with the ticket", () => {
    const link = resolveCallDepartmentLink({
      aiSummary:
        "Caller asked about a coin machine for exchanging change; Cara took a message for the team.",
      followUpSummary: "Check whether the store has a coin machine.",
      followUpTicketId: "ticket-456",
    });

    assert.ok(link);
    assert.equal(link.slug, "general");
    assert.equal(link.buttonLabel, "Open in Management");
    assert.equal(
      link.href,
      "/dashboard/departments/management?ticket=ticket-456",
    );
  });

  it("routes general enquiries without a ticket to Management", () => {
    const link = resolveCallDepartmentLink({
      aiSummary: "Caller asked what time the shop closes today.",
    });

    assert.ok(link);
    assert.equal(link.href, "/dashboard/departments/management");
    assert.equal(link.buttonLabel, "Open in Management");
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
