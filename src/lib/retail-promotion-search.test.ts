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

  it("normalizes natural Irish promotion phrasing before matching", () => {
    const tenner = parseRetailPromotionQuery(
      "what fruit is three for a tenner?",
    );
    assert.equal(tenner.mechanic, "multibuy");
    assert.equal(tenner.quantity, 3);
    assert.equal(tenner.totalEur, 10);
    assert.equal(tenner.serviceArea, "produce");

    const fiver = parseRetailPromotionQuery("anything two for a fiver?");
    assert.equal(fiver.quantity, 2);
    assert.equal(fiver.totalEur, 5);

    const quid = parseRetailPromotionQuery("what is two for six quid?");
    assert.equal(quid.quantity, 2);
    assert.equal(quid.totalEur, 6);

    const cents = parseRetailPromotionQuery("anything save fifty cent?");
    assert.equal(cents.mechanic, "save_amount");
    assert.equal(cents.amountEur, 0.5);

    const percent = parseRetailPromotionQuery("anything save thirty three percent?");
    assert.equal(percent.mechanic, "save_percent");
    assert.equal(percent.percent, 33);
  });

  it("supports percentage, money-off, half-price, fixed-price and cents mechanics", () => {
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
      parseRetailPromotionQuery("anything save 50c?").amountEur,
      0.5,
    );
    assert.equal(
      parseRetailPromotionQuery("anything only 79c in fruit?").amountEur,
      0.79,
    );
    assert.equal(
      parseRetailPromotionQuery("anything only €3 in frozen?").amountEur,
      3,
    );
  });

  it("accepts retailer badges that omit the euro symbol in multibuy wording", () => {
    const parsed = parseRetailPromotionQuery("what is 2 for 2.70 on?");
    assert.equal(parsed.mechanic, "multibuy");
    assert.equal(parsed.quantity, 2);
    assert.equal(parsed.totalEur, 2.7);
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
