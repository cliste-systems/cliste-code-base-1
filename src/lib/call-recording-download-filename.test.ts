import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callRecordingDownloadFilename,
  formatCallRecordingTimestamp,
  normalizeCallerNumberForFilename,
} from "./call-recording-download-filename";

describe("callRecordingDownloadFilename", () => {
  it("includes date, caller name, and phone number", () => {
    const filename = callRecordingDownloadFilename({
      createdAt: "2026-09-15T13:40:00.000Z",
      callerName: "Mark",
      callerNumber: "+353 87 271 5938",
    });

    assert.match(filename, /^hellocara_2026-09-15_\d{4}_Mark_353872715938\.mp3$/);
  });

  it("omits unknown caller names", () => {
    const filename = callRecordingDownloadFilename({
      createdAt: "2026-09-15T13:40:00.000Z",
      callerName: "Unknown",
      callerNumber: "+353872715938",
    });

    assert.match(filename, /^hellocara_2026-09-15_\d{4}_353872715938\.mp3$/);
  });

  it("sanitizes unsafe filename characters", () => {
    const filename = callRecordingDownloadFilename({
      createdAt: "2026-09-15T13:40:00.000Z",
      callerName: 'Mark / "test"',
      callerNumber: "+353872715938",
    });

    assert.match(filename, /^hellocara_/);
    assert.match(filename, /Mark-test/);
    assert.doesNotMatch(filename, /[\\/:*?"<>|]/);
  });
});

describe("normalizeCallerNumberForFilename", () => {
  it("strips formatting from phone numbers", () => {
    assert.equal(
      normalizeCallerNumberForFilename("+353 87 271 5938"),
      "353872715938",
    );
  });
});

describe("formatCallRecordingTimestamp", () => {
  it("formats local date and time", () => {
    const formatted = formatCallRecordingTimestamp("2026-09-15T13:40:00.000Z");
    assert.match(formatted, /^2026-09-15_\d{4}$/);
  });
});
