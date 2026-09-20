import { NextResponse } from "next/server";

import { runSupervaluOffersSyncCron } from "@/app/api/cron/supervalu-offers-sync/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Friday retry cron — only syncs if the latest batch has fewer than 350 offers.
 *
 * Scheduled Friday 07:00 Europe/Dublin via vercel.json (06:00 UTC).
 */
export async function GET(request: Request) {
  return runSupervaluOffersSyncCron(request, true);
}

export async function POST(request: Request) {
  return runSupervaluOffersSyncCron(request, true);
}
