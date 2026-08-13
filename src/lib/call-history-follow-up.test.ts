import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assignOpenTicketsToCalls } from "./call-history-follow-up";

describe("assignOpenTicketsToCalls", () => {
  const phone = "+353872715938";

  it("links an open ticket to the closest call from the same number", () => {
    const calls = [
      { id: "c1", caller_number: phone, created_at: "2026-06-25T12:31:00Z" },
      { id: "c2", caller_number: phone, created_at: "2026-06-25T12:50:00Z" },
      { id: "c3", caller_number: phone, created_at: "2026-06-25T13:00:00Z" },
    ];
    const tickets = [
      {
        id: "t1",
        caller_number: phone,
        summary: "Highlights on Monday",
        status: "open",
        created_at: "2026-06-25T12:51:00Z",
      },
    ];

    const map = assignOpenTicketsToCalls(calls, tickets);
    assert.equal(map.size, 1);
    assert.equal(map.get("c2")?.id, "t1");
    assert.equal(map.has("c1"), false);
    assert.equal(map.has("c3"), false);
  });

  it("does not mark every call from a number when only one ticket exists", () => {
    const calls = [
      { id: "a", caller_number: phone, created_at: "2026-06-25T13:03:00Z" },
      { id: "b", caller_number: phone, created_at: "2026-06-25T13:00:00Z" },
      { id: "c", caller_number: phone, created_at: "2026-06-25T12:48:00Z" },
    ];
    const tickets = [
      {
        id: "t1",
        caller_number: phone,
        summary: "Callback",
        status: "open",
        created_at: "2026-06-25T12:51:00Z",
      },
    ];

    const map = assignOpenTicketsToCalls(calls, tickets);
    assert.equal(map.size, 1);
    assert.equal(map.has("a"), false);
    assert.equal(map.has("b"), false);
    assert.equal(map.get("c")?.id, "t1");
  });

  it("ignores resolved tickets", () => {
    const calls = [
      { id: "c1", caller_number: phone, created_at: "2026-06-25T12:50:00Z" },
    ];
    const tickets = [
      {
        id: "t1",
        caller_number: phone,
        summary: "Done",
        status: "resolved",
        created_at: "2026-06-25T12:51:00Z",
      },
    ];

    assert.equal(assignOpenTicketsToCalls(calls, tickets).size, 0);
  });
});
