import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enforces tenant ownership before a service-role mutation.
 *
 * Service-role clients bypass RLS, so every dashboard path that calls
 * `createAdminClient()` must verify the target row belongs to the caller's
 * organization. Doing the check inline is easy to forget — wrapping it in a
 * helper makes the guard explicit at every dangerous call site (auth user
 * deletion, profile mutations, billing writes, etc.).
 *
 * Throws TenantGuardError on mismatch so callers cannot silently skip the
 * check by ignoring a return value.
 */
export class TenantGuardError extends Error {
  readonly code: "not_found" | "wrong_tenant" | "lookup_failed";
  constructor(code: TenantGuardError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "TenantGuardError";
  }
}

type AnySupabase = SupabaseClient<any, any, any>;

export async function assertRowBelongsToOrg(opts: {
  admin: AnySupabase;
  table: string;
  id: string;
  organizationId: string;
  organizationColumn?: string;
  idColumn?: string;
}): Promise<void> {
  const {
    admin,
    table,
    id,
    organizationId,
    organizationColumn = "organization_id",
    idColumn = "id",
  } = opts;

  const { data, error } = await admin
    .from(table)
    .select(organizationColumn)
    .eq(idColumn, id)
    .maybeSingle();

  if (error) {
    throw new TenantGuardError(
      "lookup_failed",
      `Tenant guard lookup failed for ${table}.${idColumn}=${id}: ${error.message}`,
    );
  }
  if (!data) {
    throw new TenantGuardError(
      "not_found",
      `Row ${table}.${idColumn}=${id} not found.`,
    );
  }
  const ownerId = (data as unknown as Record<string, unknown>)[organizationColumn];
  if (ownerId !== organizationId) {
    throw new TenantGuardError(
      "wrong_tenant",
      `Row ${table}.${idColumn}=${id} does not belong to organization ${organizationId}.`,
    );
  }
}
