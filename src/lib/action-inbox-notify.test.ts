import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatE164ForDisplay } from "@/lib/call-history-types";
import { PRODUCT_NAME } from "@/lib/company-details";

function buildActionInboxSms(input: {
  businessName: string;
  callerName?: string | null;
  callerNumber: string;
  summary: string;
}): string {
  const biz = input.businessName.trim() || "Your business";
  const caller =
    input.callerName?.trim() ||
    formatE164ForDisplay(input.callerNumber) ||
    input.callerNumber;
  const summary = input.summary.trim().slice(0, 500) || "A caller needs follow-up.";
  const summarySnippet =
    summary.length > 120 ? `${summary.slice(0, 117).trimEnd()}…` : summary;
  return `${biz}: New message from ${caller} — ${summarySnippet} Open ${PRODUCT_NAME} → Action Inbox.`;
}

describe("action inbox owner SMS copy", () => {
  it("includes caller name and summary snippet", () => {
    const sms = buildActionInboxSms({
      businessName: "Kavanaghs SuperValu Donegal Town",
      callerName: "Aoife Byrne",
      callerNumber: "+353861001001",
      summary:
        "Birthday cake for Saturday — chocolate sponge for about 20 people. Caller wants a quote and pickup time.",
    });
    assert.match(sms, /Kavanaghs SuperValu Donegal Town/);
    assert.match(sms, /Aoife Byrne/);
    assert.match(sms, /Birthday cake for Saturday/);
    assert.match(sms, /Action Inbox/);
  });
});
