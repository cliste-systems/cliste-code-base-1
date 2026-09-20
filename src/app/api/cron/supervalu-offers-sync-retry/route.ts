import { NextResponse } from "next/server";

import { runSupervaluOffersSyncCron } from "@/app/api/cron/supervalu-offers-sync/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Friday safety net — only runs when offers are still on a prior week.
 * Customer-facing updates must happen on Thursday; this is ops recovery only.
 *
 * Scheduled Friday 07:00 Europe/Dublin via vercel.json (06:00 UTC).
 */
export async function GET(request: Request) {
  return runSupervaluOffersSyncCron(request, "stale-week-retry");
}

export async function POST(request: Request) {
  return runSupervaluOffersSyncCron(request, "stale-week-retry");
}
