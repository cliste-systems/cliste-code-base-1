/**
 * Recompile Kavanaghs custom_prompt from structured org fields (SuperValu knowledge, departments, etc.).
 *
 *   npx tsx scripts/regenerate-kavanaghs-prompt.ts
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import { regenerateCaraCustomPrompt } from "../src/lib/cara-prompt-from-org";

const ORG_SLUG = "kavanaghs-supervalu-donegal-town";

async function main() {
  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, custom_prompt")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (error || !org?.id) {
    throw new Error(error?.message ?? `Org ${ORG_SLUG} not found`);
  }

  const beforeLen = String(org.custom_prompt ?? "").length;
  const result = await regenerateCaraCustomPrompt(admin, org.id);
  if (!result.ok) {
    throw new Error(result.message);
  }

  const { data: updated } = await admin
    .from("organizations")
    .select("custom_prompt")
    .eq("id", org.id)
    .maybeSingle();

  const prompt = String(updated?.custom_prompt ?? "");
  const afterLen = prompt.length;
  const hasRealRewards = prompt.includes("0818 220 088");
  const hasSearchTool = prompt.includes("searchSuperValuProducts");

  console.log(`✓ Regenerated prompt for ${org.name}`);
  console.log(`  Length: ${beforeLen} → ${afterLen}`);
  console.log(`  Real Rewards Helpdesk in prompt: ${hasRealRewards ? "yes" : "no"}`);
  console.log(`  searchSuperValuProducts boundary: ${hasSearchTool ? "yes" : "no"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
