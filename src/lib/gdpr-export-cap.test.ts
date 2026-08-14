import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GDPR_EXPORT_ROW_CAP, gdprExportWasTruncated } from "./gdpr-export-cap";

describe("GDPR export row cap", () => {
  it("flags truncation when any collection hits the cap", () => {
    assert.equal(GDPR_EXPORT_ROW_CAP, 5000);
    assert.equal(gdprExportWasTruncated(10, 20, 30), false);
    assert.equal(gdprExportWasTruncated(5000, 1), true);
    assert.equal(gdprExportWasTruncated(4999), false);
  });
});
