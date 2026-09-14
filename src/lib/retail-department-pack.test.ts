import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapRouteIdToDepartmentSlug,
  mapStoreDepartmentNameToSlug,
  parseRouteIdFromSummary,
} from "./retail-department-pack";

describe("retail department pack routing", () => {
  it("maps bakery route id", () => {
    assert.equal(mapRouteIdToDepartmentSlug("retail-bakery-cake"), "bakery");
  });

  it("maps store department names", () => {
    assert.equal(mapStoreDepartmentNameToSlug("Butcher"), "meat-counter");
    assert.equal(mapStoreDepartmentNameToSlug("Fish counter"), "fish-counter");
  });

  it("parses route suffix from summary", () => {
    assert.equal(
      parseRouteIdFromSummary("Cake order for Saturday [route: retail-bakery-cake]"),
      "retail-bakery-cake",
    );
  });
});
