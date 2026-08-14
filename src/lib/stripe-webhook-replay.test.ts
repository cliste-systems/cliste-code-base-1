import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  resolveWebhookClaimFromDuplicate,
} from "./stripe-webhook-replay";

type MockRow = {
  event_id: string;
  event_type: string;
  processed_at: string | null;
};

function createMockAdmin(initialRows: MockRow[] = []) {
  const rows = new Map(initialRows.map((row) => [row.event_id, { ...row }]));

  return {
    rows,
    from(table: string) {
      assert.equal(table, "stripe_webhook_events");
      return {
        insert(payload: Omit<MockRow, "event_id"> & { event_id: string }) {
          const eventId = payload.event_id;
          if (rows.has(eventId)) {
            return {
              select() {
                return {
                  async maybeSingle() {
                    return {
                      data: null,
                      error: { code: "23505", message: "duplicate key" },
                    };
                  },
                };
              },
            };
          }
          rows.set(eventId, {
            event_id: eventId,
            event_type: payload.event_type,
            processed_at: payload.processed_at ?? null,
          });
          return {
            select() {
              return {
                async maybeSingle() {
                  return {
                    data: { event_id: eventId },
                    error: null,
                  };
                },
              };
            },
          };
        },
        select(columns: string) {
          assert.equal(columns, "processed_at");
          return {
            eq(_column: string, eventId: string) {
              return {
                async maybeSingle() {
                  const row = rows.get(eventId);
                  return {
                    data: row ? { processed_at: row.processed_at } : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
        update(patch: { processed_at: string }) {
          return {
            eq(_column: string, eventId: string) {
              const row = rows.get(eventId);
              if (row) {
                row.processed_at = patch.processed_at;
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

describe("resolveWebhookClaimFromDuplicate", () => {
  it("replays when processed_at is null", () => {
    assert.equal(resolveWebhookClaimFromDuplicate(null), "replay");
    assert.equal(resolveWebhookClaimFromDuplicate(undefined), "replay");
  });

  it("returns duplicate when processed_at is set", () => {
    assert.equal(
      resolveWebhookClaimFromDuplicate("2026-08-14T12:00:00.000Z"),
      "duplicate",
    );
  });
});

describe("claimStripeWebhookEvent", () => {
  it("claims a new event with processed_at null", async () => {
    const admin = createMockAdmin();
    const claim = await claimStripeWebhookEvent(
      admin as never,
      "evt_new",
      "checkout.session.completed",
    );

    assert.equal(claim, "claimed");
    assert.equal(admin.rows.get("evt_new")?.processed_at, null);
  });

  it("replays when duplicate row is unprocessed", async () => {
    const admin = createMockAdmin([
      {
        event_id: "evt_retry",
        event_type: "checkout.session.completed",
        processed_at: null,
      },
    ]);

    const claim = await claimStripeWebhookEvent(
      admin as never,
      "evt_retry",
      "checkout.session.completed",
    );

    assert.equal(claim, "replay");
  });

  it("returns duplicate when row is already processed", async () => {
    const admin = createMockAdmin([
      {
        event_id: "evt_done",
        event_type: "checkout.session.completed",
        processed_at: "2026-08-14T12:00:00.000Z",
      },
    ]);

    const claim = await claimStripeWebhookEvent(
      admin as never,
      "evt_done",
      "checkout.session.completed",
    );

    assert.equal(claim, "duplicate");
  });
});

describe("markStripeWebhookEventProcessed", () => {
  it("sets processed_at on the event row", async () => {
    const admin = createMockAdmin([
      {
        event_id: "evt_mark",
        event_type: "checkout.session.completed",
        processed_at: null,
      },
    ]);

    await markStripeWebhookEventProcessed(admin as never, "evt_mark");

    assert.ok(admin.rows.get("evt_mark")?.processed_at);
  });
});
