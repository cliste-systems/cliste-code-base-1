import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCallerSmsBody } from "./caller-sms-content";

describe("formatCallerSmsBody", () => {
  it("prefixes with business name", () => {
    assert.equal(
      formatCallerSmsBody({
        businessName: "Acme Hair",
        body: "Your booking link: https://example.com/book",
      }),
      "Acme Hair: Your booking link: https://example.com/book",
    );
  });

  it("does not double-prefix when name already present", () => {
    const body = "Acme Hair: Your booking link: https://example.com/book";
    assert.equal(
      formatCallerSmsBody({ businessName: "Acme Hair", body }),
      body,
    );
  });

  it("returns body unchanged when business name is empty", () => {
    assert.equal(
      formatCallerSmsBody({
        businessName: "",
        body: "https://example.com/book",
      }),
      "https://example.com/book",
    );
  });
});
