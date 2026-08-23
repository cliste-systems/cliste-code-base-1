type AdminLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

/** Keep organizations.phone_number aligned with the assigned pool row. */
export async function syncOrgPhoneNumberCache(
  admin: AdminLike,
  organizationId: string,
  e164: string,
): Promise<void> {
  const { data: org, error: readErr } = await admin
    .from("organizations")
    .select("phone_number")
    .eq("id", organizationId)
    .maybeSingle();

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
