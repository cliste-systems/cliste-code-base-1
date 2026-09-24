import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_GATE_COOKIE_PREFIX,
  createGateCookieValue,
  isValidGateCookieValue,
} from "./gate-cookie";

test("gate cookie validates inside its permitted lifetime", async () => {
  const secret = "test-secret";
  const token = await createGateCookieValue(
    ADMIN_GATE_COOKIE_PREFIX,
    secret,
    60,
  );

  assert.equal(
    await isValidGateCookieValue(
      token,
      ADMIN_GATE_COOKIE_PREFIX,
      secret,
      60,
    ),
    true,
  );
});

test("legacy long-lived gate cookie is rejected by a shorter maximum", async () => {
  const secret = "test-secret";
  const token = await createGateCookieValue(
    ADMIN_GATE_COOKIE_PREFIX,
    secret,
    60 * 60 * 24 * 7,
  );

  assert.equal(
    await isValidGateCookieValue(
      token,
      ADMIN_GATE_COOKIE_PREFIX,
      secret,
      60 * 60 * 24,
    ),
    false,
  );
});

test("gate cookie cannot be validated with another secret", async () => {
  const token = await createGateCookieValue(
    ADMIN_GATE_COOKIE_PREFIX,
    "correct-secret",
    60,
  );

  assert.equal(
    await isValidGateCookieValue(
      token,
      ADMIN_GATE_COOKIE_PREFIX,
      "wrong-secret",
      60,
    ),
    false,
  );
});
