import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveOrgSenderEmail,
  sanitizeOrgEmailLocalPart,
} from "./org-sender-email.data";

describe("sanitizeOrgEmailLocalPart", () => {
  it("normalizes slug characters", () => {
    assert.equal(sanitizeOrgEmailLocalPart("Acme Hair!"), "acme-hair");
  });

  it("rejects reserved local parts", () => {
    assert.equal(sanitizeOrgEmailLocalPart("support"), null);
    assert.equal(sanitizeOrgEmailLocalPart("privacy"), null);
  });

  it("rejects too-short slugs", () => {
    assert.equal(sanitizeOrgEmailLocalPart("a"), null);
  });
});

describe("resolveOrgSenderEmail", () => {
  it("builds slug-based from and reply-to", () => {
    const sender = resolveOrgSenderEmail({
      name: "Acme Hair Studio",
      slug: "acme-hair",
      notificationEmail: "owner@acme.ie",
    });
    assert.deepEqual(sender, {
      email: "acme-hair@clistesystems.ie",
      name: "Acme Hair Studio",
      replyTo: "owner@acme.ie",
    });
  });

  it("returns null when slug cannot be sanitized", () => {
    assert.equal(
      resolveOrgSenderEmail({
        name: "Support Desk",
        slug: "support",
      }),
      null,
    );
  });
});
