import { isTestCalledNumber, TEST_LINE_E164 } from "@/lib/call-testing-types";
import type { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ResolvedTestCallContext = {
  effectiveCalledNumber: string;
  isTestCall: boolean;
};

/** Detect internal QA rings even when the worker omits called_number (legacy payloads). */
export async function resolveTestCallContext(input: {
  admin: AdminClient;
  orgId: string;
  calledNumberRaw?: string | null;
  workerMarkedTest?: boolean;
}): Promise<ResolvedTestCallContext> {
  const fromBody = input.calledNumberRaw?.trim() ?? "";
  if (input.workerMarkedTest || isTestCalledNumber(fromBody)) {
    return {
      effectiveCalledNumber: fromBody || TEST_LINE_E164,
      isTestCall: true,
    };
  }

  const { data: org } = await input.admin
    .from("organizations")
    .select("phone_number")
    .eq("id", input.orgId)
    .maybeSingle();

  const orgPhone = (org?.phone_number as string | null)?.trim() ?? "";
  if (isTestCalledNumber(orgPhone)) {
    return {
      effectiveCalledNumber: fromBody || orgPhone || TEST_LINE_E164,
      isTestCall: true,
    };
  }

  const { data: phones } = await input.admin
    .from("phone_numbers")
    .select("e164")
    .eq("organization_id", input.orgId);

  const assignedTest = (phones ?? [])
    .map((p) => (p.e164 as string | null)?.trim())
    .find((e164) => isTestCalledNumber(e164));

  if (assignedTest) {
    return {
      effectiveCalledNumber: fromBody || assignedTest,
      isTestCall: true,
    };
  }

  return {
    effectiveCalledNumber: fromBody,
    isTestCall: false,
  };
}
