"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

/** Only count calls from the last few hours so stale rows can't false-unlock. */
const RECENT_CALL_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function checkTestCallReceived(): Promise<{ received: boolean }> {
  const session = await requireOnboardingSession();
  const supabase = await createClient();

  const since = new Date(Date.now() - RECENT_CALL_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", session.organizationId)
    .gte("created_at", since);

  if (error) {
    console.warn("[test-call] call_logs check failed", error.message);
    return { received: false };
  }

  return { received: (count ?? 0) > 0 };
}

export type RetryPhoneProvisionResult =
  | { ok: true; phoneNumber: string }
  | { ok: false; message: string };

export async function retryPhoneProvision(): Promise<RetryPhoneProvisionResult> {
  const session = await requireOnboardingSession();
  const result = await provisionOrganizationPhoneNumber(session.organizationId);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/onboarding/test-call");
  return { ok: true, phoneNumber: result.e164 };
}

/** Move on from the test call to the final go-live (plan + payment) step. */
export async function completeTestCallStep(): Promise<never> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  await admin
    .from("organizations")
    .update({
      onboarding_step: ONBOARDING_STEPS.goLive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/plan");
}
