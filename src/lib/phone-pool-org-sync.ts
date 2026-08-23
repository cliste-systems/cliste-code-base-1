type AdminLike = {
  from(table: string): {
    select(columns: string): unknown;
    eq(column: string, value: unknown): unknown;
    maybeSingle(): Promise<{ data: { phone_number?: string | null } | null; error: { message: string } | null }>;
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
};

/** Keep organizations.phone_number aligned with the assigned pool row. */
export async function syncOrgPhoneNumberCache(
  admin: AdminLike,
  organizationId: string,
  e164: string,
): Promise<void> {
  const query = admin.from("organizations").select("phone_number").eq("id", organizationId);
  const { data: org, error: readErr } = await (query as {
    maybeSingle(): Promise<{ data: { phone_number?: string | null } | null; error: { message: string } | null }>;
  }).maybeSingle();

  if (readErr) {
    console.warn(
      "[phone-pool] syncOrgPhoneNumberCache read failed",
      organizationId,
      readErr.message,
    );
    return;
  }

  const current = org?.phone_number?.trim() ?? "";
  if (current === e164) return;

  const { error: updateErr } = await admin
    .from("organizations")
    .update({
      phone_number: e164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (updateErr) {
    console.warn(
      "[phone-pool] syncOrgPhoneNumberCache update failed",
      organizationId,
      updateErr.message,
    );
  }
}
