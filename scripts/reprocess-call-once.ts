import { config } from "dotenv";
config({ path: ".env.local" });

import { reprocessCallLogPostCall } from "../src/lib/post-call-reprocess.ts";

async function main() {
  const callLogId = "48b26233-97b2-46cb-8b88-d1cf14f26219";
  const result = await reprocessCallLogPostCall(callLogId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
