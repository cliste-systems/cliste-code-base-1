import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  catalogEconomicsEqual,
  dedupeCatalogDrafts,
  dedupeCatalogDraftsWithStats,
  findCatalogNameConflict,
  findCatalogNearDuplicate,
} from "@/lib/service-catalog-format";

const draft = (
  name: string,
  price: number,
  durationMinutes: number,
) => ({
  name,
  price,
  durationMinutes,
  category: null,
  description: null,
  aiVoiceNotes: null,
  policyFlags: [],
  source: "booking_import" as const,
});

describe("service catalog dedupe", () => {
  it("blocks exact and near-duplicate names with matching economics", () => {
    const catalog = [
      { id: "1", name: "Add-On French/Ombre", price: 0, durationMinutes: 0 },
      { id: "2", name: "Gel Polish", price: 25, durationMinutes: 30 },
    ];
    assert.equal(
      findCatalogNameConflict("add-on french/ombre", catalog),
      "Add-On French/Ombre",
    );
    assert.equal(findCatalogNameConflict("Gel Polish", catalog, "2"), null);
  });

  it("allows similar names when price or duration differ", () => {
    const catalog = [
      { id: "1", name: "Balayage", price: 80, durationMinutes: 90 },
    ];
    assert.equal(
      findCatalogNearDuplicate(
        { id: "x", name: "Balayage", price: 95, durationMinutes: 90 },
        catalog,
      ),
      null,
    );
    assert.equal(
      findCatalogNameConflict("Balayage", catalog, undefined, {
        price: 95,
        durationMinutes: 90,
      }),
      null,
    );
    assert.ok(catalogEconomicsEqual({ price: 80, durationMinutes: 90 }, { price: 80, durationMinutes: 90 }));
  });

  it("dedupes imported drafts only when name and economics match", () => {
    const drafts = dedupeCatalogDrafts([
      draft("Cut & Blow Dry", 45, 45),
      draft("cut & blow dry", 50, 50),
      draft("Colour", 80, 90),
    ]);
    assert.equal(drafts.length, 3);

    const merged = dedupeCatalogDraftsWithStats([
      draft("Cut & Blow Dry", 45, 45),
      draft("cut & blow dry", 45, 45),
      draft("Colour", 80, 90),
    ]);
    assert.equal(merged.drafts.length, 2);
    assert.equal(merged.mergedCount, 1);
    assert.equal(merged.drafts[0]?.name, "Cut & Blow Dry");
    assert.equal(merged.drafts[1]?.name, "Colour");
  });
});
