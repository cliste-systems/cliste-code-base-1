import { syncOrgPhoneNumberCache } from "@/lib/phone-pool-org-sync";

export type AssignFromPoolResult =
  | { ok: true; e164: string; phoneNumberId: string }
  | { ok: false; message: string };

type PhoneNumbersAdmin = {
  from(table: "phone_numbers"): PhoneNumbersQuery;
};

type PhoneNumbersQuery = {
  select(columns: string): PhoneNumbersQuery;
  eq(column: string, value: unknown): PhoneNumbersQuery;
  order(column: string, opts: { ascending: boolean }): PhoneNumbersQuery;
  limit(n: number): PhoneNumbersQuery;
  update(payload: Record<string, unknown>): PhoneNumbersQuery;
  maybeSingle(): Promise<{
    data: { id: string; e164: string } | null;
    error: { message: string; code?: string } | null;
  }>;
};

function devPreferredPoolE164(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.CLISTE_DEV_POOL_E164?.trim();
  return raw?.startsWith("+") ? raw : null;
}

export async function findAssignedNumberForOrg(
  admin: PhoneNumbersAdmin,
  organizationId: string,
): Promise<AssignFromPoolResult | null> {
  const { data: assigned } = await admin
    .from("phone_numbers")
    .select("id, e164")
    .eq("organization_id", organizationId)
    .eq("status", "assigned")
    .maybeSingle();

  if (assigned?.e164) {
    await syncOrgPhoneNumberCache(admin, organizationId, assigned.e164);
    return {
      ok: true,
      e164: assigned.e164,
      phoneNumberId: assigned.id,
    };
  }
  return null;
}

export async function assignFromPoolForOrg(
  admin: PhoneNumbersAdmin,
  organizationId: string,
  country: "IE" | "US" = "IE",
): Promise<AssignFromPoolResult> {
  const preferredE164 = devPreferredPoolE164();

  for (let attempt = 0; attempt < 3; attempt++) {
    let candidate: { id: string; e164: string } | null = null;
    let pickErr: { message: string; code?: string } | null = null;

    if (attempt === 0 && preferredE164) {
      const { data, error } = await admin
        .from("phone_numbers")
        .select("id, e164")
        .eq("status", "available")
        .eq("country_code", country)
        .eq("e164", preferredE164)
        .maybeSingle();
      candidate = data;
      pickErr = error;
    }

    if (!candidate) {
      const { data, error } = await admin
        .from("phone_numbers")
        .select("id, e164")
        .eq("status", "available")
        .eq("country_code", country)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      candidate = data;
      pickErr = error;
    }

    if (pickErr) {
      return { ok: false, message: pickErr.message };
    }
    if (!candidate) {
      return {
        ok: false,
        message:
          "No phone numbers available in the pool. Contact support or wait for the nightly refill.",
      };
    }

    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from("phone_numbers")
      .update({
        status: "assigned",
        organization_id: organizationId,
        assigned_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", candidate.id)
      .eq("status", "available")
      .select("id, e164")
      .maybeSingle();

    if (claimErr) {
      if (claimErr.code === "23505") {
        const raced = await findAssignedNumberForOrg(admin, organizationId);
        if (raced) return raced;
      }
      return { ok: false, message: claimErr.message };
    }
    if (claimed?.id) {
      await syncOrgPhoneNumberCache(admin, organizationId, claimed.e164);
      return { ok: true, e164: claimed.e164, phoneNumberId: claimed.id };
    }
  }

  return {
    ok: false,
    message:
      "Could not claim a pool number after retries. Refresh and try again.",
  };
}

export async function provisionExistingPhoneForOrg(
  admin: PhoneNumbersAdmin,
  organizationId: string,
): Promise<AssignFromPoolResult | null> {
  return findAssignedNumberForOrg(admin, organizationId);
}
