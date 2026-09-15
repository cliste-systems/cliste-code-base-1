import { describe, expect, it } from "vitest";

import {
  mergeIncomingCallEvent,
  shouldClearCallsIncomingPlaceholder,
  shouldShowCallsIncomingPlaceholder,
} from "./calls-incoming-placeholder";

describe("shouldShowCallsIncomingPlaceholder", () => {
  it("shows on today page 1 only", () => {
    const placeholder = {
      phase: "loading" as const,
      callerNumber: "+353861001001",
      callLogId: "abc",
      startedAt: "2026-09-15T12:00:00.000Z",
    };

    expect(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: true,
        page: 1,
        placeholder,
      }),
    ).toBe(true);
    expect(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: false,
        page: 1,
        placeholder,
      }),
    ).toBe(false);
    expect(
      shouldShowCallsIncomingPlaceholder({
        viewingToday: true,
        page: 2,
        placeholder,
      }),
    ).toBe(false);
  });
});

describe("shouldClearCallsIncomingPlaceholder", () => {
  it("clears when the call log id appears", () => {
    expect(
      shouldClearCallsIncomingPlaceholder(
        {
          phase: "loading",
          callerNumber: null,
          callLogId: "call-1",
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        [{ id: "call-1", createdAt: "2026-09-15T12:01:00.000Z" }],
      ),
    ).toBe(true);
  });

  it("clears in-progress rows when a new call lands after start time", () => {
    expect(
      shouldClearCallsIncomingPlaceholder(
        {
          phase: "in_progress",
          callerNumber: "+353861001001",
          callLogId: null,
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        [{ id: "call-2", createdAt: "2026-09-15T12:00:30.000Z" }],
      ),
    ).toBe(true);
  });
});

describe("mergeIncomingCallEvent", () => {
  it("upgrades in-progress to loading while keeping caller number", () => {
    expect(
      mergeIncomingCallEvent(
        {
          phase: "in_progress",
          callerNumber: "+353861001001",
          callLogId: null,
          startedAt: "2026-09-15T12:00:00.000Z",
        },
        {
          phase: "loading",
          callLogId: "call-1",
        },
      ),
    ).toEqual({
      phase: "loading",
      callerNumber: "+353861001001",
      callLogId: "call-1",
      startedAt: "2026-09-15T12:00:00.000Z",
    });
  });
});
