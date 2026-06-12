import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeBaseTown,
  serviceAreaAnchorTown,
} from "./base-town";

describe("base-town", () => {
  it("normalizes whitespace and caps length", () => {
    assert.equal(normalizeBaseTown("  Letterkenny  "), "Letterkenny");
  });

  it("prefers explicit base town over address fallback", () => {
    assert.equal(
      serviceAreaAnchorTown("Letterkenny", "Main St, Donegal"),
      "Letterkenny",
    );
  });

  it("falls back to last address segment when base town is empty", () => {
    assert.equal(
      serviceAreaAnchorTown("", "12 Main St, Letterkenny"),
      "Letterkenny",
    );
  });
});
