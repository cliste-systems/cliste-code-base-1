import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTicketCallLinks } from "./resolve-ticket-call-log";

const ORG = "org-1";
const CALL_ID = "11111111-1111-4111-8111-111111111111";
const TICKET_ID = "22222222-2222-4222-8222-222222222222";

function mockSupabase(responses: {
  linkedCalls?: Array<{ id: string; created_at: string }>;
  windowCalls?: Array<{ id: string; caller_number: string; created_at: string }>;
}) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return this;
        },
        in(column: string, values: unknown) {
          filters[`in:${column}`] = values;
          return this;
        },
        gte(column: string, value: unknown) {
          filters[`gte:${column}`] = value;
          return this;
        },
        lte(column: string, value: unknown) {
          filters[`lte:${column}`] = value;
          return this;
        },
        order() {
          return this;
        },
        async then(
          resolve: (value: { data: unknown[] }) => void,
        ) {
          if (table === "call_logs" && filters["in:id"]) {
            resolve({ data: responses.linkedCalls ?? [] });
            return;
          }
          if (table === "call_logs" && filters["gte:created_at"]) {
            resolve({ data: responses.windowCalls ?? [] });
            return;
          }
          resolve({ data: [] });
        },
      };
    },
  } as never;
}

describe("resolveTicketCallLinks", () => {
  it("uses stored call_log_id and call created_at", async () => {
    const links = await resolveTicketCallLinks(
      mockSupabase({
        linkedCalls: [{ id: CALL_ID, created_at: "2026-09-14T17:30:00.000Z" }],
      }),
      ORG,
      [
        {
          id: TICKET_ID,
          call_log_id: CALL_ID,
          caller_number: "+353872715938",
          created_at: "2026-09-14T17:35:00.000Z",
        },
      ],
    );

    assert.deepEqual(links.get(TICKET_ID), {
      callLogId: CALL_ID,
      callCreatedAt: "2026-09-14T17:30:00.000Z",
    });
  });

  it("matches orphan tickets by caller and time window", async () => {
    const links = await resolveTicketCallLinks(
      mockSupabase({
        windowCalls: [
          {
            id: CALL_ID,
            caller_number: "+353872715938",
            created_at: "2026-09-14T17:30:00.000Z",
          },
        ],
      }),
      ORG,
      [
        {
          id: TICKET_ID,
          call_log_id: null,
          caller_number: "+353872715938",
          created_at: "2026-09-14T17:35:00.000Z",
        },
      ],
    );

    assert.deepEqual(links.get(TICKET_ID), {
      callLogId: CALL_ID,
      callCreatedAt: "2026-09-14T17:30:00.000Z",
    });
  });
});
