import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  retailSearchCandidateTerms,
  retailSearchTextScore,
  retailSearchTokenMatchesText,
} from "./retail-search-fuzzy";

describe("retail fuzzy search", () => {
  it("treats omitted apostrophes as the same brand", () => {
    const text =
      "kellogg s rice krispies caramel chocolate squares cereal bars 1023070000";

    assert.ok(retailSearchTextScore(text, "Kellogg's") > 0);
    assert.ok(retailSearchTextScore(text, "Kelloggs") > 0);
    assert.ok(retailSearchTokenMatchesText(text, "Kelloggs"));
  });

  it("matches punctuation-collapsed brands", () => {
    const text = "coca cola zero sugar soft drinks";
    assert.ok(retailSearchTextScore(text, "Coca-Cola") > 0);
    assert.ok(retailSearchTextScore(text, "CocaCola") > 0);
  });

  it("accepts a small spelling mistake without matching unrelated words", () => {
    const text = "kellogg s rice krispies family cereals";
    assert.ok(retailSearchTextScore(text, "kelogs") > 0);
    assert.equal(retailSearchTextScore("heinz baked beans grocery", "kelogs"), 0);
  });

  it("requires every meaningful word in a multi-word query", () => {
    const text = "kellogg s rice krispies chocolate squares cereal bars";
    assert.ok(retailSearchTextScore(text, "kellogs rice krispies") > 0);
    assert.equal(retailSearchTextScore(text, "kellogs corn flakes"), 0);
  });

  it("builds safe broad candidate terms for database pre-filtering", () => {
    assert.deepEqual(retailSearchCandidateTerms("Kellogg's"), ["kellogg", "kel"]);
    assert.deepEqual(retailSearchCandidateTerms("Kelloggs"), ["kellogg", "kel"]);
    assert.ok(retailSearchCandidateTerms("kelogs").includes("kel"));
    assert.deepEqual(retailSearchCandidateTerms("1023070000"), ["1023070000"]);
  });
});
