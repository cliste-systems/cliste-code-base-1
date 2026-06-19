import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBookingFulfilmentMethod,
  buildBookingBackupDescription,
  captureNoteFromBackupDescription,
  inferBookingFulfilmentMethod,
} from "./booking-fulfilment";
import type { SavedRoute } from "./route-models";

const baseBookingRoute: SavedRoute = {
  id: "route_test",
  templateId: "booking-inquiry",
  name: "",
  keywords: "book an appointment",
  outcome: "send_link",
  active: true,
  url: "https://example.com/book",
  businessFileId: null,
  email: "",
  whatsapp: "",
  note: "",
  linkDelivery: "sms",
};

const captureFields = [
  { id: "name", label: "Name" },
  { id: "phone", label: "Phone number" },
  { id: "preferred_service", label: "Preferred service" },
  { id: "preferred_day", label: "Preferred day" },
];

describe("booking fulfilment", () => {
  it("infers link method by default", () => {
    assert.equal(inferBookingFulfilmentMethod(baseBookingRoute), "link");
  });

  it("infers callback from action_inbox outcome", () => {
    const route = applyBookingFulfilmentMethod(
      baseBookingRoute,
      "callback",
      captureFields,
    );
    assert.equal(inferBookingFulfilmentMethod(route), "callback");
    assert.equal(route.outcome, "action_inbox");
    assert.match(route.note, /preferred service/);
  });

  it("infers both from backup description marker", () => {
    const route = applyBookingFulfilmentMethod(
      baseBookingRoute,
      "both",
      captureFields,
    );
    assert.equal(inferBookingFulfilmentMethod(route), "both");
    assert.equal(route.outcome, "send_link");
    assert.match(route.description ?? "", /BOOKING_BACKUP:/);
  });

  it("round-trips capture note from backup description", () => {
    const note = "name, phone number, preferred service, and preferred day.";
    const description = buildBookingBackupDescription(note);
    assert.equal(captureNoteFromBackupDescription(description), note);
  });
});
