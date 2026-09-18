import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyActionCategory } from "./categories";

describe("classifyActionCategory", () => {
  it("classifies birthday cake orders as order", () => {
    assert.equal(
      classifyActionCategory(
        "Stephen called to order a birthday cake for Sean with blue icing and collection on Friday.",
      ),
      "order",
    );
  });

  it("does not let order confirmation wording override order category", () => {
    assert.equal(
      classifyActionCategory(
        "Birthday cake order for Friday — order details were confirmed and logged.",
      ),
      "order",
    );
  });

  it("classifies complaints separately from orders", () => {
    assert.equal(
      classifyActionCategory("Complaint — product return for chicken bought last week."),
      "complaint",
    );
  });

  it("does not classify facility enquiries as sales leads", () => {
    assert.equal(
      classifyActionCategory(
        "Coin machine enquiry\nRequest: Does the store have a machine to exchange coins for cash?",
      ),
      "follow_up",
    );
  });
});
