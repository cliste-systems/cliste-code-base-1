import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hashRateLimitIdentifier,
  rateLimitFingerprint,
  rateLimitIdentifierFingerprint,
} from "./auth-rate-limit";

describe("auth-rate-limit fingerprints", () => {
  it("rateLimitFingerprint is stable for the same IP hint", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10",
    });
    const a = rateLimitFingerprint(headers, "auth-ip");
    const b = rateLimitFingerprint(headers, "auth-ip");
    assert.equal(a, b);
  });

  it("rateLimitFingerprint ignores user-agent changes", () => {
    const base = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10",
    });
    const withUa = new Headers(base);
    withUa.set("user-agent", "TotallyDifferentBot/9.9");
    assert.equal(
      rateLimitFingerprint(base, "auth-ip"),
      rateLimitFingerprint(withUa, "auth-ip"),
    );
  });

  it("email fingerprint does not include IP", () => {
    const emailFp = rateLimitIdentifierFingerprint("auth-email:owner@example.com");
    assert.match(emailFp, /^[a-f0-9]{64}$/);
    assert.equal(
      emailFp,
      hashRateLimitIdentifier("auth-email:owner@example.com"),
    );
  });
});
