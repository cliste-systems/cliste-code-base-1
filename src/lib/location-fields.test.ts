import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatLocationPhrase,
  parseStoredLocation,
} from "./location-fields";

describe("location-fields", () => {
  it("parses structured columns", () => {
    assert.deepEqual(
      parseStoredLocation({
        address: "14 Grafton Street",
        baseTown: "Dublin 2",
        county: "Dublin",
      }),
      { street: "14 Grafton Street", town: "Dublin 2", county: "Dublin" },
    );
  });

  it("splits legacy comma-separated address", () => {
    assert.deepEqual(
      parseStoredLocation({
        address: "14 Grafton Street, Dublin 2",
      }),
      { street: "14 Grafton Street", town: "Dublin 2", county: "" },
    );
  });

  it("formats prompt location line", () => {
    assert.equal(
      formatLocationPhrase(
        { street: "14 Grafton Street", town: "Dublin 2", county: "Dublin" },
        "D02 VF65",
      ),
      "14 Grafton Street, Dublin 2, Dublin, D02 VF65",
    );
  });
});
