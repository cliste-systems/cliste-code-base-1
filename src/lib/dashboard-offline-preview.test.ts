import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOfflinePreviewQuery,
  OFFLINE_PREVIEW_ORG,
} from "./dashboard-offline-preview";

describe("offline dashboard preview query", () => {
  it("is thenable and returns the offline organization row", async () => {
    const rows = await createOfflinePreviewQuery("organizations");
    assert.deepEqual(rows.data, [OFFLINE_PREVIEW_ORG]);
    assert.equal(rows.error, null);
  });

  it("returns empty lists for live tables", async () => {
    const query = createOfflinePreviewQuery("call_logs") as {
      eq: (column: string, value: string) => {
        limit: (n: number) => Promise<{ data: unknown; count: number }>;
      };
    };
    const rows = await query.eq("organization_id", "x").limit(10);
    assert.deepEqual(rows.data, []);
    assert.equal(rows.count, 0);
  });

  it("supports maybeSingle for organization lookups", async () => {
    const query = createOfflinePreviewQuery("organizations") as {
      maybeSingle: () => Promise<{ data: { id: string } | null }>;
    };
    const row = await query.maybeSingle();
    assert.equal(row.data?.id, OFFLINE_PREVIEW_ORG.id);
  });
});
