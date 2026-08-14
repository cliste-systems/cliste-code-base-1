import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSafeAuthNextPath } from "./auth-callback-next";

describe("resolveSafeAuthNextPath", () => {
  it("honours a relative dashboard path", () => {
    assert.equal(
      resolveSafeAuthNextPath("/dashboard/set-password"),
      "/dashboard/set-password",
    );
  });

  it("rejects open redirects", () => {
    assert.equal(resolveSafeAuthNextPath("https://evil.example"), null);
    assert.equal(resolveSafeAuthNextPath("//evil.example"), null);
    assert.equal(resolveSafeAuthNextPath("\\evil"), null);
    assert.equal(resolveSafeAuthNextPath("dashboard"), null);
  });
});
