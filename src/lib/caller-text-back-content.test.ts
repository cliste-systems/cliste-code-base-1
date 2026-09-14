import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCallerTextBackCallFooter,
  buildCallerTextBackDisclaimer,
  buildCallerTextBackIntro,
  buildCallerTextBackSmsHref,
  callerTextBackFirstName,
  composeCallerTextBackMessage,
  formatStorePhoneForTextBack,
} from "./caller-text-back-content";

describe("callerTextBackFirstName", () => {
  it("uses the first word of the caller name", () => {
    assert.equal(callerTextBackFirstName("Brendan O'Toole"), "Brendan");
  });

  it("falls back when the caller is unknown", () => {
    assert.equal(callerTextBackFirstName("Unknown caller"), "there");
  });
});

describe("formatStorePhoneForTextBack", () => {
  it("formats Irish store lines for local readers", () => {
    assert.equal(formatStorePhoneForTextBack("+353749722977"), "074 972 2977");
  });
});

describe("composeCallerTextBackMessage", () => {
  it("builds one SMS with intro, reply, and call footer", () => {
    assert.equal(
      composeCallerTextBackMessage({
        callerName: "Sarah",
        businessName: "Kavanaghs SuperValu Donegal Town",
        middle: "Your cake will be ready for collection at 4pm.",
        storePhoneE164: "+353749722977",
      }),
      [
        "Do not reply to this text.",
        "Hi Sarah, thanks for contacting Kavanaghs SuperValu Donegal Town earlier.",
        "Your cake will be ready for collection at 4pm.",
        "If you have any other questions, give Cara a call on 074 972 2977.",
      ].join("\n\n"),
    );
  });

  it("uses a generic greeting when the caller name is unknown", () => {
    assert.equal(
      buildCallerTextBackIntro("Unknown caller", "Kavanaghs SuperValu Donegal Town"),
      "Hi there, thanks for contacting Kavanaghs SuperValu Donegal Town earlier.",
    );
  });

  it("includes the do-not-reply disclaimer", () => {
    assert.equal(buildCallerTextBackDisclaimer(), "Do not reply to this text.");
  });

  it("builds an sms href with encoded body", () => {
    const href = buildCallerTextBackSmsHref(
      "+353871234567",
      composeCallerTextBackMessage({
        callerName: "Tim",
        businessName: "Acme Hair",
        middle: "See you tomorrow.",
        storePhoneE164: "+353749722977",
      }),
    );
    assert.match(href, /^sms:\+353871234567\?body=/);
    assert.match(
      decodeURIComponent(href.split("body=")[1] ?? ""),
      /thanks for contacting Acme Hair earlier/,
    );
  });

  it("omits the call footer when no store phone is set", () => {
    assert.equal(buildCallerTextBackCallFooter(""), null);
  });
});
