import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureSalonBookingRouteInPayload } from "@/app/(onboarding)/onboarding/knowledge/ensure-salon-booking-route";

describe("ensureSalonBookingRouteInPayload", () => {
  it("adds callback booking route when salon has no booking route", () => {
    const { routes, handleOptions } = ensureSalonBookingRouteInPayload({
      routes: [],
      captureFields: [
        { id: "name", label: "Name" },
        { id: "phone", label: "Phone" },
      ],
      handleOptions: ["take_message"],
      niche: "hair_salon",
      businessType: "hair salon",
    });

    const booking = routes.find((r) => r.templateId === "booking-inquiry");
    assert.ok(booking);
    assert.equal(booking?.outcome, "action_inbox");
    assert.equal(handleOptions.includes("send_link"), false);
  });

  it("adds link booking route when a valid booking URL is provided", () => {
    const { routes, handleOptions } = ensureSalonBookingRouteInPayload({
      routes: [],
      linkUrl: "https://fresha.com/a/salon/booking",
      captureFields: [],
      handleOptions: ["take_message"],
      niche: "hair_salon",
      businessType: "hair salon",
    });

    const booking = routes.find((r) => r.templateId === "booking-inquiry");
    assert.equal(booking?.outcome, "send_link");
    assert.equal(booking?.url, "https://fresha.com/a/salon/booking");
    assert.equal(handleOptions.includes("send_link"), true);
  });
});
