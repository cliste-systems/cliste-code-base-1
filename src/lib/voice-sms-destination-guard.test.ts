import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  allowedSmsDialPrefixes,
  smsDestinationAllowed,
} from "./voice-sms-destination-guard";

const ENV_KEYS = [
  "VOICE_SMS_ALLOWED_DIAL_PREFIXES",
  "VOICE_SMS_ALLOW_ALL_COUNTRIES",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("smsDestinationAllowed", () => {
  it("allows the default IE/GB/US prefixes", () => {
    assert.equal(smsDestinationAllowed("+353871234567"), true);
    assert.equal(smsDestinationAllowed("+447700900123"), true);
    assert.equal(smsDestinationAllowed("+14155550123"), true);
  });

  it("blocks classic international toll-fraud destinations by default", () => {
    assert.equal(smsDestinationAllowed("+8801700000000"), false); // Bangladesh
    assert.equal(smsDestinationAllowed("+2348012345678"), false); // Nigeria
    assert.equal(smsDestinationAllowed("+371234567"), false); // Latvia premium-ish
  });

  it("rejects non-E.164 input so it cannot bypass the prefix check", () => {
    assert.equal(smsDestinationAllowed("0871234567"), false);
    assert.equal(smsDestinationAllowed(""), false);
    assert.equal(smsDestinationAllowed("not a number"), false);
  });

  it("honours an env-configured prefix list", () => {
    process.env.VOICE_SMS_ALLOWED_DIAL_PREFIXES = "+61, +353";
    assert.equal(smsDestinationAllowed("+61400000000"), true);
    assert.equal(smsDestinationAllowed("+353871234567"), true);
    assert.equal(smsDestinationAllowed("+447700900123"), false);
  });

  it("falls back to defaults when the env list is empty/garbage", () => {
    process.env.VOICE_SMS_ALLOWED_DIAL_PREFIXES = "   ,  ";
    assert.deepEqual(allowedSmsDialPrefixes(), ["+353", "+44", "+1"]);
  });

  it("allows everything when the escape hatch is set", () => {
    process.env.VOICE_SMS_ALLOW_ALL_COUNTRIES = "1";
    assert.equal(smsDestinationAllowed("+8801700000000"), true);
  });
});
