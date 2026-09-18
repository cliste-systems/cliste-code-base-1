import "../../scripts/mock-server-only.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCaraSetupPromptInputFromOrg } from "./cara-prompt-from-org";
import { defaultWeekSchedule, serializeBusinessHours } from "./business-hours";

describe("cara-prompt-from-org", () => {
  it("prefers structured schedule over legacy opening hours text", () => {
    const schedule = defaultWeekSchedule();
    schedule.thursday = { open: true, start: "08:00", end: "18:00" };
    const input = buildCaraSetupPromptInputFromOrg({
      agent_opening_hours: "Mon–Sat 8am–9pm",
      business_hours: serializeBusinessHours(schedule),
    });
    assert.match(input.openingHours ?? "", /6pm/i);
    assert.doesNotMatch(input.openingHours ?? "", /9pm/i);
  });
});
