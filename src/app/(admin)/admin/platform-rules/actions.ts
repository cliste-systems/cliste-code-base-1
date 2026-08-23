"use server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  loadPlatformCaraRules,
  savePlatformCaraRules,
  type PlatformCaraRules,
} from "@/lib/platform-cara-rules";
import { regenerateAllCaraCustomPrompts } from "@/lib/regenerate-all-cara-prompts";
import { createAdminClient } from "@/utils/supabase/admin";

export async function savePlatformCaraRulesAction(
  input: PlatformCaraRules,
): Promise<
  | {
      ok: true;
      regenerated: number;
      greetingsUpdated: number;
      failedCount: number;
    }
  | { ok: false; message: string }
> {
  const user = await requireAdminSessionUser();
  const admin = createAdminClient();

  const saveResult = await savePlatformCaraRules(admin, input, user.id);
  if (!saveResult.ok) return saveResult;

  const regen = await regenerateAllCaraCustomPrompts(admin, {
    refreshGreetings: true,
  });

  if (!regen.ok && regen.regenerated === 0) {
    return {
      ok: false,
      message:
        regen.failed[0]?.message ??
        "Rules saved but prompt regeneration failed for all organizations.",
    };
  }

  return {
    ok: true,
    regenerated: regen.regenerated,
    greetingsUpdated: regen.greetingsUpdated,
    failedCount: regen.failed.length,
  };
}

export async function loadPlatformCaraRulesForAdmin(): Promise<PlatformCaraRules> {
  await requireAdminSessionUser();
  const admin = createAdminClient();
  return loadPlatformCaraRules(admin);
}
