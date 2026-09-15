import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actionTicketUnderReviewCopy,
  displayActionTicketSummary,
  isUnderReviewTicket,
} from "../app/(dashboard)/dashboard/action-inbox/action-inbox-helpers";

describe("pending_review ticket presentation", () => {
  it("shows customer-safe under review copy", () => {
    assert.match(actionTicketUnderReviewCopy(), /confirming the details/i);
    assert.equal(
      displayActionTicketSummary("⚠ Processing review — birthday cake", undefined, {
        underReview: true,
      }),
      actionTicketUnderReviewCopy(),
    );
  });

  it("detects under review delivery status", () => {
    assert.equal(
      isUnderReviewTicket({ underReview: false, deliveryStatus: "pending_review" }),
      true,
    );
    assert.equal(
      isUnderReviewTicket({ underReview: false, deliveryStatus: "confirmed" }),
      false,
    );
  });
});
