import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FEATURED_DEMO_LINE_E164,
  formatIrishE164Display,
  sortDemoCallLinesByCompany,
  workerPathLabelForE164,
  type AdminDemoCallLine,
} from "./admin-demo-call-lines";
import {
  INTERNAL_QA_LINE_E164,
  TEST_LINE_E164,
} from "./call-testing-types";

describe("admin-demo-call-lines", () => {
  it("labels worker paths for featured demo numbers", () => {
    assert.equal(workerPathLabelForE164(TEST_LINE_E164), "Demo stack");
    assert.equal(
      workerPathLabelForE164(FEATURED_DEMO_LINE_E164[1]),
      "Retail demo lane",
    );
    assert.equal(workerPathLabelForE164(INTERNAL_QA_LINE_E164), "Production");
    assert.equal(workerPathLabelForE164("+353871234567"), "Production");
  });

  it("formats Irish E.164 for display", () => {
    assert.equal(
      formatIrishE164Display("+353749759508"),
      "+353 74 975 9508",
    );
    assert.equal(
      formatIrishE164Display("+353749389378"),
      "+353 74 938 9378",
    );
  });

  it("sorts lines alphabetically by company name", () => {
    const lines: AdminDemoCallLine[] = [
      {
        orgId: "2",
        orgName: "Murphy's SuperValu",
        orgSlug: "murphys",
        e164: "+353109307440",
        niche: "retail",
        provisionSource: "managed",
        workerPath: "Production",
      },
      {
        orgId: "1",
        orgName: "Hello Cara Demo",
        orgSlug: "hello-cara",
        e164: "+353749389378",
        niche: "other",
        provisionSource: "managed",
        workerPath: "Demo stack",
      },
    ];
    const sorted = sortDemoCallLinesByCompany(lines);
    assert.equal(sorted[0]?.orgName, "Hello Cara Demo");
    assert.equal(sorted[1]?.orgName, "Murphy's SuperValu");
  });
});
