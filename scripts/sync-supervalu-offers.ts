#!/usr/bin/env tsx
/**
 * Manual SuperValu weekly offers sync + striploin search smoke test.
 *
 * Usage:
 *   npx tsx scripts/sync-supervalu-offers.ts
 *   npx tsx scripts/sync-supervalu-offers.ts --search "striploin steak"
 */
import "dotenv/config";

import { searchRetailWeeklyOffers } from "../src/lib/retail-weekly-offers-search";
import { fetchSupervaluMeatPilotOffers } from "../src/lib/supervalu-offers-fetch";
import {
  persistSupervaluNationalOffers,
  toSupervaluOffersSyncResult,
} from "../src/lib/supervalu-offers-persist";
import { createAdminClient } from "../src/utils/supabase/admin";

async function main() {
  const searchArgIndex = process.argv.indexOf("--search");
  const searchQuery =
    searchArgIndex >= 0 ? String(process.argv[searchArgIndex + 1] ?? "").trim() : "";

  const admin = createAdminClient();
  const offers = await fetchSupervaluMeatPilotOffers();
  const persisted = await persistSupervaluNationalOffers(admin, offers);
  if (!persisted.ok) {
    console.error("Sync failed:", persisted.message);
    process.exit(1);
  }

  const result = toSupervaluOffersSyncResult(persisted);
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `\nNote: prompt recompile runs via cron/admin refresh — this script persists offers only.`,
  );

  const query = searchQuery || "striploin steak";
  const matches = await searchRetailWeeklyOffers(admin, "supervalu", query);
  console.log(`\nSearch "${query}": ${matches.length} match(es)`);
  for (const match of matches) {
    console.log(`- ${match.productName}: ${match.quoteText}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
