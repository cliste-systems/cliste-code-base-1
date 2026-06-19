import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

describe("dashboardVerticalCopy routing overrides", () => {
  it("applies trades niche overrides on the generic vertical", () => {
    const copy = dashboardVerticalCopy("trades");
    const block = copy.routing.exampleBlock;
    assert.ok(block);
    assert.equal(block.keywords, "emergency, urgent, same day, leak");
    assert.equal(block.name, "Emergency callouts — your label in the list");
  });

  it("keeps salon routing for hair_salon without niche override", () => {
    const copy = dashboardVerticalCopy("hair_salon");
    const block = copy.routing.exampleBlock;
    assert.ok(block);
    assert.equal(block.keywords, "balayage, roots touch-up, full colour");
    assert.equal(block.name, "Colour bookings — your label in the list");
  });

  it("applies other niche default routing override on generic vertical", () => {
    const copy = dashboardVerticalCopy("other");
    const block = copy.routing.exampleBlock;
    assert.ok(block);
    assert.equal(
      block.keywords,
      "book an appointment, schedule a visit, make a booking",
    );
    assert.equal(block.name, "Appointment requests — your label in the list");
  });
});
