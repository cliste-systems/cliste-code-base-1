import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignFromPoolForOrg,
  findAssignedNumberForOrg,
} from "./phone-pool-assign";
import { syncOrgPhoneNumberCache } from "./phone-pool-org-sync";

type PhoneRow = {
  id: string;
  e164: string;
  status: "available" | "assigned" | "cooldown";
  organization_id: string | null;
  country_code: string;
  created_at: string;
};

type OrgRow = {
  id: string;
  phone_number: string | null;
};

function createMockAdmin(state: {
  phones: PhoneRow[];
  orgs: OrgRow[];
}) {
  const orgUpdates: Array<{ id: string; phone_number: string }> = [];

  const admin = {
    from(table: string) {
      if (table === "phone_numbers") {
        return buildPhoneQuery(state.phones);
      }
      if (table === "organizations") {
        return buildOrgQuery(state.orgs, orgUpdates);
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    orgUpdates,
  };

  return admin;
}

function buildPhoneQuery(phones: PhoneRow[]) {
  const filters: Record<string, unknown> = {};
  let updatePayload: Record<string, unknown> | null = null;
  let selecting = false;

  const chain = {
    select() {
      selecting = true;
      return chain;
    },
    eq(column: string, value: unknown) {
      filters[column] = value;
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    update(payload: Record<string, unknown>) {
      updatePayload = payload;
      selecting = true;
      return chain;
    },
    async maybeSingle() {
      if (updatePayload) {
        const idx = phones.findIndex(
          (p) =>
            p.id === filters.id &&
            (filters.status === undefined || p.status === filters.status),
        );
        if (idx >= 0 && phones[idx]!.status === "available") {
          phones[idx] = {
            ...phones[idx]!,
            status: "assigned",
            organization_id: updatePayload.organization_id as string,
          };
          return {
            data: { id: phones[idx]!.id, e164: phones[idx]!.e164 },
            error: null,
          };
        }
        return { data: null, error: null };
      }

      const matches = phones.filter((p) =>
        Object.entries(filters).every(
          ([k, v]) => (p as Record<string, unknown>)[k] === v,
        ),
      );
      const row = matches[0] ?? null;
      return {
        data: row && selecting ? { id: row.id, e164: row.e164 } : row,
        error: null,
      };
    },
  };

  return chain;
}

function buildOrgQuery(
  orgs: OrgRow[],
  orgUpdates: Array<{ id: string; phone_number: string }>,
) {
  let orgId: string | null = null;
  let updatePayload: Record<string, unknown> | null = null;
  let reading = false;

  const applyUpdate = async () => {
    if (!updatePayload || !orgId) return { error: null };
    const idx = orgs.findIndex((o) => o.id === orgId);
    if (idx >= 0) {
      orgs[idx]!.phone_number = updatePayload.phone_number as string;
      orgUpdates.push({
        id: orgId,
        phone_number: updatePayload.phone_number as string,
      });
    }
    return { error: null };
  };

  const chain = {
    select() {
      reading = true;
      return chain;
    },
    eq(column: string, value: unknown) {
      if (column === "id") orgId = value as string;
      if (updatePayload) {
        return applyUpdate();
      }
      return chain;
    },
    update(payload: Record<string, unknown>) {
      updatePayload = payload;
      reading = false;
      return chain;
    },
    async maybeSingle() {
      if (updatePayload) {
        await applyUpdate();
        return { data: null, error: null };
      }
      const org = orgs.find((o) => o.id === orgId) ?? null;
      return {
        data: org && reading ? { phone_number: org.phone_number } : org,
        error: null,
      };
    },
  };

  return chain;
}

describe("syncOrgPhoneNumberCache", () => {
  it("writes organizations.phone_number when empty", async () => {
    const orgId = "00000000-0000-4000-8000-000000000001";
    const state = {
      phones: [] as PhoneRow[],
      orgs: [{ id: orgId, phone_number: null }],
    };
    const mockAdmin = createMockAdmin(state);

    await syncOrgPhoneNumberCache(mockAdmin as never, orgId, "+353871234567");

    assert.equal(state.orgs[0]!.phone_number, "+353871234567");
    assert.equal(mockAdmin.orgUpdates.length, 1);
  });

  it("is a no-op when org cache already matches", async () => {
    const orgId = "00000000-0000-4000-8000-000000000002";
    const e164 = "+353871234568";
    const state = {
      phones: [] as PhoneRow[],
      orgs: [{ id: orgId, phone_number: e164 }],
    };
    const mockAdmin = createMockAdmin(state);

    await syncOrgPhoneNumberCache(mockAdmin as never, orgId, e164);

    assert.equal(mockAdmin.orgUpdates.length, 0);
  });

  it("repairs mismatched org cache", async () => {
    const orgId = "00000000-0000-4000-8000-000000000003";
    const state = {
      phones: [] as PhoneRow[],
      orgs: [{ id: orgId, phone_number: "+353870000000" }],
    };
    const mockAdmin = createMockAdmin(state);

    await syncOrgPhoneNumberCache(mockAdmin as never, orgId, "+353871234569");

    assert.equal(state.orgs[0]!.phone_number, "+353871234569");
  });
});

describe("assignFromPoolForOrg", () => {
  const orgId = "00000000-0000-4000-8000-000000000010";
  const phoneId = "10000000-0000-4000-8000-000000000001";
  const e164 = "+353871111111";

  it("fresh assign writes both phone_numbers and organizations cache", async () => {
    const state = {
      phones: [
        {
          id: phoneId,
          e164,
          status: "available" as const,
          organization_id: null,
          country_code: "IE",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      orgs: [{ id: orgId, phone_number: null }],
    };
    const mockAdmin = createMockAdmin(state);

    const result = await assignFromPoolForOrg(mockAdmin as never, orgId, "IE");

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.e164, e164);
    }
    assert.equal(state.phones[0]!.status, "assigned");
    assert.equal(state.orgs[0]!.phone_number, e164);
  });

  it("re-assign is idempotent and returns the same number", async () => {
    const state = {
      phones: [
        {
          id: phoneId,
          e164,
          status: "assigned" as const,
          organization_id: orgId,
          country_code: "IE",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      orgs: [{ id: orgId, phone_number: e164 }],
    };
    const mockAdmin = createMockAdmin(state);

    const first = await findAssignedNumberForOrg(mockAdmin as never, orgId);
    const second = await findAssignedNumberForOrg(mockAdmin as never, orgId);

    assert.ok(first?.ok);
    assert.ok(second?.ok);
    if (first?.ok && second?.ok) {
      assert.equal(first.e164, second.e164);
    }
    assert.equal(mockAdmin.orgUpdates.length, 0);
  });

  it("repair path fixes desynced organizations.phone_number", async () => {
    const state = {
      phones: [
        {
          id: phoneId,
          e164,
          status: "assigned" as const,
          organization_id: orgId,
          country_code: "IE",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      orgs: [{ id: orgId, phone_number: null }],
    };
    const mockAdmin = createMockAdmin(state);

    const result = await findAssignedNumberForOrg(mockAdmin as never, orgId);

    assert.ok(result?.ok);
    assert.equal(state.orgs[0]!.phone_number, e164);
    assert.equal(mockAdmin.orgUpdates.length, 1);
  });
});
