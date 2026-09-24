import assert from "node:assert/strict";
import test from "node:test";

import {
  attachmentMayBeOpened,
  attachmentPolicyAllowsType,
} from "./admin-email-attachment-safety";

test("attachment policy accepts an allowed clean PDF", () => {
  assert.equal(
    attachmentPolicyAllowsType({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    }),
    true,
  );

  assert.equal(
    attachmentMayBeOpened({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      scanStatus: "clean",
    }),
    true,
  );
});

test("attachment policy fails closed before malware scan completes", () => {
  assert.equal(
    attachmentMayBeOpened({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      scanStatus: "pending",
    }),
    false,
  );
});

test("attachment policy rejects executable and oversized content", () => {
  assert.equal(
    attachmentPolicyAllowsType({
      filename: "payload.exe",
      contentType: "application/octet-stream",
      sizeBytes: 1024,
    }),
    false,
  );

  assert.equal(
    attachmentPolicyAllowsType({
      filename: "large.pdf",
      contentType: "application/pdf",
      sizeBytes: 11 * 1024 * 1024,
    }),
    false,
  );
});
