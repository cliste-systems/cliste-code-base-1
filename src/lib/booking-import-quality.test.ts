import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessBookingImportQuality } from "@/lib/booking-import-quality";

describe("assessBookingImportQuality", () => {
  it("flags a single generic service as low confidence", () => {
    const result = assessBookingImportQuality([
      {
        name: "Service 1",
        category: "",
        price: null,
        durationMinutes: null,
        notes: "",
      },
    ]);
    assert.equal(result.quality, "low");
    assert.ok(result.qualityMessage);
  });
});
