import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { promoteExpiredCooldowns, refillPoolIfLow } from "../src/lib/phone-pool.js";

async function main() {
  console.log("[phone-pool] promoting expired cooldowns…");
  const promoted = await promoteExpiredCooldowns();
  console.log(`[phone-pool] promoted ${promoted} cooldown numbers back to available`);

  console.log("[phone-pool] refilling pool…");
  const result = await refillPoolIfLow();
  console.log("[phone-pool] refill result:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
