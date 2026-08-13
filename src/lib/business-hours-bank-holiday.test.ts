import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatBankHolidaysForAgent } from "./agent-knowledge-format";
import {
  defaultBankHolidayConfig,
  parseBusinessHoursBundle,
  serializeBusinessHours,
  defaultWeekSchedule,
} from "./business-hours";
import { buildHoursPromptBlock } from "./general-boundary";

describe("bank holiday hours", () => {
  it("serializes and parses bank holiday config", () => {
    const raw = serializeBusinessHours(defaultWeekSchedule(), {
      bankHolidays: {
        configured: true,
        open: true,
        start: "10:00",
        end: "14:00",
      },
    });
    const parsed = parseBusinessHoursBundle(raw);
    assert.equal(parsed.meta.bankHolidays?.configured, true);
    assert.equal(parsed.meta.bankHolidays?.open, true);
    assert.equal(parsed.meta.bankHolidays?.start, "10:00");
  });

  it("formats closed bank holidays for Cara", () => {
    const line = formatBankHolidaysForAgent({
      ...defaultBankHolidayConfig(),
      configured: true,
      open: false,
    });
    assert.match(line, /Closed on bank/i);
  });

  it("includes bank holidays and breaks in prompt block", () => {
    const block = buildHoursPromptBlock({
      neverConfigured: false,
      open24_7: false,
      schedule: defaultWeekSchedule(),
      formattedHours: "Mon–Fri: 9am–5:30pm",
      note: "Lunch break 12:30–1:30pm",
      bankHolidays: {
        configured: true,
        open: false,
        start: "10:00",
        end: "14:00",
      },
    });
    assert.match(block ?? "", /Breaks & exceptions/i);
    assert.match(block ?? "", /Lunch break/i);
    assert.match(block ?? "", /Closed on bank/i);
  });
});
