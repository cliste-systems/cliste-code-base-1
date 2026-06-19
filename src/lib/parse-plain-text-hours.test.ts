import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { weekScheduleHasOpenDay } from "@/lib/business-hours";
import { parsePlainTextOpeningHours, recoverHoursNoteFromSources } from "@/lib/parse-plain-text-hours";

describe("parsePlainTextOpeningHours", () => {
  it("parses salon-style Tue–Fri and Saturday hours", () => {
    const result = parsePlainTextOpeningHours(
      "Tuesday–Friday 9:00–18:00, Saturday 9:00–17:00. Closed Sunday and Monday.",
    );
    assert.ok(result);
    assert.equal(result.confidence, "parsed");
    assert.equal(result.schedule.tuesday.open, true);
    assert.equal(result.schedule.tuesday.start, "09:00");
    assert.equal(result.schedule.tuesday.end, "18:00");
    assert.equal(result.schedule.saturday.open, true);
    assert.equal(result.schedule.saturday.end, "17:00");
    assert.equal(result.schedule.sunday.open, false);
    assert.equal(result.schedule.monday.open, false);
    assert.ok(weekScheduleHasOpenDay(result.schedule));
  });

  it("parses Mon-Fri 9am-6pm shorthand", () => {
    const result = parsePlainTextOpeningHours("Mon-Fri 9am-6pm");
    assert.ok(result);
    assert.equal(result.schedule.monday.open, true);
    assert.equal(result.schedule.monday.start, "09:00");
    assert.equal(result.schedule.monday.end, "18:00");
    assert.equal(result.schedule.saturday.open, false);
  });

  it("returns fallback with hours note when parse is ambiguous", () => {
    const result = parsePlainTextOpeningHours(
      "Open most weekdays until late — call ahead",
    );
    assert.ok(result);
    assert.equal(result.confidence, "fallback");
    assert.ok(result.hoursNote?.includes("call ahead"));
    assert.equal(weekScheduleHasOpenDay(result.schedule), false);
  });

  it("returns null for empty input", () => {
    assert.equal(parsePlainTextOpeningHours(""), null);
    assert.equal(parsePlainTextOpeningHours("   "), null);
  });

  it("parses appointment-only weekdays alongside fixed hours", () => {
    const result = parsePlainTextOpeningHours(
      "Thu–Sat 10am–10pm. Mon–Wed by appointment only. Closed public holidays.",
    );
    assert.ok(result);
    assert.equal(result.schedule.monday.open, true);
    assert.equal(result.schedule.monday.start, "09:00");
    assert.equal(result.schedule.thursday.open, true);
    assert.equal(result.schedule.thursday.end, "22:00");
    assert.ok(result.hoursNote?.includes("by appointment"));
    assert.ok(result.hoursNote?.toLowerCase().includes("public holidays"));
  });

  it("keeps bank holiday note when the weekly schedule parses", () => {
    const result = parsePlainTextOpeningHours(
      "Monday 10:00–18:00. Closed bank holidays.",
    );
    assert.ok(result);
    assert.equal(result.schedule.monday.open, true);
    assert.ok(result.hoursNote?.toLowerCase().includes("bank holidays"));
  });
});

describe("recoverHoursNoteFromSources", () => {
  it("falls back to business rules when structured storage has no note", () => {
    const note = recoverHoursNoteFromSources(
      "",
      "Mon 10:00–18:00",
      ["We're closed on bank holidays."],
    );
    assert.match(note.toLowerCase(), /bank holidays/);
  });
});
