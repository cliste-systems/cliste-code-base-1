import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { phoneQueryMatchesCaller } from "./caller-phone-search";

describe("phoneQueryMatchesCaller", () => {
  const stored = "+353872715938";
  const displayed = "+353 87 271 5938";

  it("matches Irish local numbers without country prefix", () => {
    assert.equal(phoneQueryMatchesCaller("0872715938", stored), true);
    assert.equal(phoneQueryMatchesCaller("872715938", stored), true);
    assert.equal(phoneQueryMatchesCaller("087 271 5938", stored), true);
  });

  it("matches international and plus formats", () => {
    assert.equal(phoneQueryMatchesCaller("+353872715938", stored), true);
    assert.equal(phoneQueryMatchesCaller("353872715938", stored), true);
    assert.equal(phoneQueryMatchesCaller("+353 87 271 5938", displayed), true);
  });

  it("matches partial digit searches", () => {
    assert.equal(phoneQueryMatchesCaller("715938", stored), true);
    assert.equal(phoneQueryMatchesCaller("2715938", stored), true);
  });

  it("does not match unrelated numbers", () => {
    assert.equal(phoneQueryMatchesCaller("0871234567", stored), false);
    assert.equal(phoneQueryMatchesCaller("abc", stored), false);
  });
});
