import { NextResponse } from "next/server";

import { loadAdminDemoCallLines } from "@/lib/admin-demo-call";
import { requireAdminSessionUser } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const lines = await loadAdminDemoCallLines();
    return NextResponse.json({ lines });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load demo lines.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
