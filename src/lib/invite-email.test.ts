import assert from "node:assert/strict";
import test from "node:test";

import { buildInviteEmailBodies } from "./invite-email-bodies";

const actionLink =
  "https://app.clistesystems.ie/auth/callback?token_hash=abc&type=invite";
const logoUrl = "https://app.clistesystems.ie/m8x4p2n7.png";

test("invite subject includes name without leading comma", () => {
  const bodies = buildInviteEmailBodies({
    actionLink,
    logoUrl,
    recipientName: "Jane",
    businessName: "Last Look Hair",
    productName: "Salon",
  });
  assert.equal(bodies.subject, "Jane, you've been invited to Cliste");
  assert.equal(bodies.subject.startsWith(","), false);
});

test("invite subject omits name when empty", () => {
  const bodies = buildInviteEmailBodies({
    actionLink,
    logoUrl,
    businessName: "Last Look Hair",
    productName: "Salon",
  });
  assert.equal(bodies.subject, "You've been invited to Cliste");
});

test("invite html uses cliste branding and first-party link", () => {
  const bodies = buildInviteEmailBodies({
    actionLink,
    logoUrl,
    businessName: "Last Look Hair",
    productName: "Salon",
  });
  assert.match(bodies.html, /m8x4p2n7\.png/);
  assert.match(bodies.html, /Accept invitation/);
  assert.match(bodies.html, /Join Last Look Hair on Cliste/);
  assert.doesNotMatch(bodies.text, /supabase\.co/);
  assert.ok(bodies.text.includes(actionLink));
});
