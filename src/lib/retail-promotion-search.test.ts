import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseRetailPromotionQuery,
  shouldUseStructuredPromotionSearch,
} from "@/lib/retail-promotion-search";

describe("retail promotion query parsing", () => {
  it("parses the failed 3-for-10 produce call as a multibuy browse", () => {
    const parsed = parseRetailPromotionQuery(
      "what are the 3 for €10 offers in the fruit and veg?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 10);
    assert.equal(parsed.serviceArea, "produce");
    assert.deepEqual(parsed.subjectTokens, []);
    assert.equal(shouldUseStructuredPromotionSearch(
      "what are the 3 for €10 offers in the fruit and veg?",
    ), true);
  });

  it("supports spoken-number multibuy wording", () => {
    const parsed = parseRetailPromotionQuery(
      "which berries are three for ten euro this week?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 10);
    assert.deepEqual(parsed.subjectTokens, ["berries"]);
  });

  it("keeps Real Rewards as an independent promotion constraint", () => {
    const parsed = parseRetailPromotionQuery(
      "any Real Rewards offers on cereal?",
    );

    assert.equal(parsed.mechanic, "loyalty");
    assert.equal(parsed.loyaltyRequired, true);
    assert.deepEqual(parsed.subjectTokens, ["cereal"]);
  });

  it("supports Rewards multibuys without collapsing them to a unit price", () => {
    const parsed = parseRetailPromotionQuery(
      "what is on 3 for €5 with Rewards?",
    );

    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.loyaltyRequired, true);
    assert.equal(parsed.quantity, 3);
    assert.equal(parsed.totalEur, 5);
  });

  it("supports percentage, money-off, half-price and fixed-price mechanics", () => {
    assert.equal(
      parseRetailPromotionQuery("what is half price this week?").mechanic,
      "half_price",
    );
    assert.equal(
      parseRetailPromotionQuery("anything save 20% in household?").percent,
      20,
    );
    assert.equal(
      parseRetailPromotionQuery("what has save €2 on it?").amountEur,
      2,
    );
    assert.equal(
      parseRetailPromotionQuery("anything only €3 in frozen?").amountEur,
      3,
    );
  });

  it("treats named campaigns as data lookups rather than invented answers", () => {
    const parsed = parseRetailPromotionQuery("what are the Super 7 offers?");
    assert.equal(parsed.mechanic, "named");
    assert.equal(parsed.namedPhrase, "super 7");
  });

  it("leaves ordinary product offer questions on the normal product path", () => {
    assert.equal(shouldUseStructuredPromotionSearch("is sirloin on offer?"), false);
  });
});
