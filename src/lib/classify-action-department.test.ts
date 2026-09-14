import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actionTicketBriefSummary,
  classifyActionDepartment,
  shouldNotifyOwnerBySms,
} from "./classify-action-department";

describe("classifyActionDepartment", () => {
  it("routes corned beef deli enquiries to deli", () => {
    assert.equal(
      classifyActionDepartment({
        summary: "Caller asked about corned beef on offer in the deli — callback needed.",
      }),
      "deli",
    );
  });

  it("routes wine enquiries to off-licence", () => {
    assert.equal(
      classifyActionDepartment({
        summary: "Caller asked what wine is on offer this week.",
      }),
      "off-licence",
    );
  });

  it("routes steak callbacks to meat counter", () => {
    assert.equal(
      classifyActionDepartment({
        summary: "Callback — striploin steak price at the butcher counter.",
      }),
      "meat-counter",
    );
  });

  it("maps bakery route id from summary suffix", () => {
    assert.equal(
      classifyActionDepartment({
        summary: "Birthday cake order for Saturday [route: retail-bakery-cake]",
      }),
      "bakery",
    );
  });

  it("prefers explicit department slug", () => {
    assert.equal(
      classifyActionDepartment({
        summary: "Generic message",
        departmentSlug: "fish-counter",
      }),
      "fish-counter",
    );
  });

  it("builds brief summary from first sentence", () => {
    assert.equal(
      actionTicketBriefSummary(
        "Caller asked about corned beef on offer.\n\nName: Jane\nPhone: +353871234567",
      ),
      "Caller asked about corned beef on offer.",
    );
  });

  it("strips demo rehearsal marker from brief summary", () => {
    assert.equal(
      actionTicketBriefSummary(
        "[demo rehearsal] Callback — striploin steak price at the butcher counter.",
      ),
      "Callback — striploin steak price at the butcher counter.",
    );
  });
});

describe("shouldNotifyOwnerBySms", () => {
  it("allows SMS only for management complaints", () => {
    assert.equal(
      shouldNotifyOwnerBySms({
        summary: "Birthday cake order\nFor: Jamie",
        departmentSlug: "bakery",
      }),
      false,
    );
    assert.equal(
      shouldNotifyOwnerBySms({
        summary: "Complaint — manager callback\nIssue: delivery never arrived",
        departmentSlug: "management",
      }),
      true,
    );
  });
});
