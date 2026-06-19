import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fallbackServiceCatalogSupplement,
  filterSupplementAgainstCatalog,
  isCatalogDuplicate,
  parseStoredServiceCatalogSupplement,
} from "./service-catalog-supplement";
import {
  findCatalogDuplicateLineHints,
  looksLikeCatalogListDump,
  sanitizeServicesOfferedRaw,
} from "./service-offered-raw";

const CATALOG = [
  "Acrylic Full Set Colour",
  "Gel Manicure",
  "Brow Tint",
];

describe("service-offered-raw", () => {
  it("detects a full catalog list dump via exact line matches", () => {
    const raw = "Acrylic Full Set Colour\nGel Manicure\nBrow Tint";
    assert.equal(looksLikeCatalogListDump(raw, CATALOG), true);
    assert.equal(sanitizeServicesOfferedRaw({ raw, catalogNames: CATALOG }), "");
  });

  it("keeps a single supplemental sentence", () => {
    const raw = "We also do mobile bridal hair by appointment.";
    assert.equal(looksLikeCatalogListDump(raw, CATALOG), false);
    assert.equal(
      sanitizeServicesOfferedRaw({ raw, catalogNames: CATALOG }),
      raw,
    );
  });

  it("flags duplicate lines for blur hints", () => {
    const hints = findCatalogDuplicateLineHints(
      "Acrylic Full Set Colour, mobile bridal hair",
      CATALOG,
    );
    assert.deepEqual(hints, ["Acrylic Full Set Colour"]);
  });

  it("treats normalized chip list as a dump when it matches offered chips", () => {
    const raw = "Gel Manicure\nBrow Tint\nAcrylic Full Set Colour";
    const offeredChips = "Acrylic Full Set Colour\nBrow Tint\nGel Manicure";
    assert.equal(
      looksLikeCatalogListDump(raw, CATALOG, offeredChips),
      true,
    );
  });
});

describe("service-catalog-supplement", () => {
  it("filters supplemental services that duplicate the catalog", () => {
    const filtered = filterSupplementAgainstCatalog(
      {
        supplementalServices: ["Gel Manicure", "mobile bridal hair"],
        generalNotes: "Patch test required for all colour.",
      },
      CATALOG,
    );
    assert.deepEqual(filtered.supplementalServices, ["mobile bridal hair"]);
    assert.match(filtered.generalNotes, /Patch test/);
  });

  it("detects near-duplicate catalog names", () => {
    assert.equal(isCatalogDuplicate("gel manicures", CATALOG), true);
    assert.equal(isCatalogDuplicate("mobile bridal hair", CATALOG), false);
  });

  it("parses stored jsonb supplement", () => {
    const parsed = parseStoredServiceCatalogSupplement({
      supplementalServices: ["Bridal packages"],
      generalNotes: "By appointment only.",
    });
    assert.deepEqual(parsed?.supplementalServices, ["Bridal packages"]);
    assert.equal(parsed?.generalNotes, "By appointment only.");
  });

  it("fallback extraction keeps net-new services and policy notes", () => {
    const supplement = fallbackServiceCatalogSupplement(
      "Gel Manicure, mobile bridal hair. All colour needs a patch test first.",
      CATALOG,
    );
    assert.deepEqual(supplement.supplementalServices, ["mobile bridal hair"]);
    assert.match(supplement.generalNotes, /patch test/i);
  });
});

describe("compileCaraPrompt services supplement", () => {
  it("includes supplemental block when catalog supplement is provided", async () => {
    const { compileCaraPrompt } = await import("./compile-cara-prompt");
    const prompt = compileCaraPrompt({
      businessName: "BT Salon",
      assistantDisplayName: "Cara",
      businessType: "Beauty salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Gel Manicure",
          category: null,
          price: 35,
          durationMinutes: 45,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "booking_import",
        },
      ],
      serviceCatalogSupplement: {
        supplementalServices: ["mobile bridal hair"],
        generalNotes: "All colour appointments need a patch test.",
      },
    });
    assert.match(prompt, /Also offered \(not on the menu above\):/);
    assert.match(prompt, /mobile bridal hair/);
    assert.match(prompt, /patch test/);
  });
});
