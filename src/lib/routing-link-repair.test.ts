import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializeRoutes, type SavedRoute } from "@/app/(dashboard)/dashboard/routing/route-models";
import { repairCorruptedRoutingLinks } from "@/lib/routing-link-repair";
import type { RoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-links";

function sendLinkRoute(url: string): SavedRoute {
  return {
    id: "route_booking",
    templateId: "booking-inquiry",
    name: "Book an appointment",
    keywords: "book, booking",
    outcome: "send_link",
    active: true,
    url,
    businessFileId: null,
    email: "",
    whatsapp: "",
    note: "",
  };
}

describe("serializeRoutes link hardening", () => {
  it("persists valid https URLs on send_link routes", () => {
    const links = serializeRoutes([
      sendLinkRoute("https://fresha.com/a/salon/booking"),
    ]);
    assert.equal(links.length, 1);
    assert.equal(links[0]?.url, "https://fresha.com/a/salon/booking");
    assert.equal(links[0]?.targetType, "link");
  });

  it("drops prose capture text from send_link routes", () => {
    const links = serializeRoutes([
      sendLinkRoute("name, phone number, preferred service, preferred day"),
    ]);
    assert.equal(links.length, 0);
  });
});

describe("repairCorruptedRoutingLinks", () => {
  it("clears bad link url and moves prose to fallback inbox row", () => {
    const input: RoutingLink[] = [
      {
        id: "route_booking",
        presetId: "booking-inquiry",
        label: "Booking",
        intent: "book",
        targetType: "link",
        url: "name, phone number, preferred service",
        links: null,
        urls: null,
        businessFileId: null,
        active: true,
      },
      {
        id: "route_fallback",
        presetId: "anything-else",
        label: "Anything else",
        intent: "anything else",
        targetType: "callback",
        url: "Take a message for the team",
        links: null,
        urls: null,
        businessFileId: null,
        active: true,
      },
    ];

    const repaired = repairCorruptedRoutingLinks(input);
    assert.equal(repaired[0]?.url, "");
    assert.match(repaired[1]?.url ?? "", /preferred service/);
  });

  it("preserves valid booking URLs", () => {
    const input: RoutingLink[] = [
      {
        id: "route_booking",
        presetId: "booking-inquiry",
        label: "Booking",
        intent: "book",
        targetType: "link",
        url: "https://booksy.com/en-ie/s/test",
        links: null,
        urls: null,
        businessFileId: null,
        active: true,
      },
    ];
    const repaired = repairCorruptedRoutingLinks(input);
    assert.equal(repaired[0]?.url, "https://booksy.com/en-ie/s/test");
  });
});
