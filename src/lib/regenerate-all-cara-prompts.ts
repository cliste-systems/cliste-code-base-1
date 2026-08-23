import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  reassembleOrgGreetingForPlatformRules,
} from "@/lib/platform-cara-rules-shared";
import { loadPlatformCaraRules } from "@/lib/platform-cara-rules";

export type RegenerateAllCaraPromptsResult = {
  ok: boolean;
  regenerated: number;
  greetingsUpdated: number;
  failed: { organizationId: string; message: string }[];
};

type OrgRow = {
  id: string;
  name: string | null;
  greeting: string | null;
  assistant_display_name: string | null;
};

export { reassembleOrgGreetingForPlatformRules } from "@/lib/platform-cara-rules-shared";

export async function regenerateAllCaraCustomPrompts(
  supabase: SupabaseClient,
  options?: { refreshGreetings?: boolean },
): Promise<RegenerateAllCaraPromptsResult> {
  const platformRules = await loadPlatformCaraRules(supabase);
  const refreshGreetings = options?.refreshGreetings ?? true;

  const failed: { organizationId: string; message: string }[] = [];
  let regenerated = 0;
  let greetingsUpdated = 0;
  const pageSize = 50;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, greeting, assistant_display_name")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      return {
        ok: false,
        regenerated,
        greetingsUpdated,
        failed: [{ organizationId: "*", message: error.message }],
      };
    }

    const rows = (data ?? []) as OrgRow[];
    if (rows.length === 0) break;

    for (const org of rows) {
      if (refreshGreetings) {
        const nextGreeting = reassembleOrgGreetingForPlatformRules(
          String(org.greeting ?? ""),
          String(org.name ?? ""),
          String(org.assistant_display_name ?? ""),
          platformRules,
        );
        if (nextGreeting !== String(org.greeting ?? "").trim()) {
          const { error: greetingError } = await supabase
            .from("organizations")
            .update({
              greeting: nextGreeting,
              updated_at: new Date().toISOString(),
            })
            .eq("id", org.id);
          if (greetingError) {
            failed.push({
              organizationId: org.id,
              message: `Greeting update: ${greetingError.message}`,
            });
            continue;
          }
          greetingsUpdated += 1;
        }
      }

      const result = await regenerateCaraCustomPrompt(supabase, org.id);
      if (!result.ok) {
        failed.push({ organizationId: org.id, message: result.message });
        continue;
      }
      regenerated += 1;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return {
    ok: failed.length === 0,
    regenerated,
    greetingsUpdated,
    failed,
  };
}
