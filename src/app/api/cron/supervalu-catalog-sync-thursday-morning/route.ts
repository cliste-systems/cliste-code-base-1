import { runSupervaluCatalogSyncCron } from "@/app/api/cron/supervalu-catalog-sync/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = runSupervaluCatalogSyncCron;
export const POST = runSupervaluCatalogSyncCron;
