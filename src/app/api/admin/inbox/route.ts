import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  listAdminInbox,
  type AdminEmailFolder,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS = new Set<AdminEmailFolder>(["inbox", "archived", "sent"]);

export async function GET(request: Request) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawFolder = url.searchParams.get("folder") ?? "inbox";
  const folder = FOLDERS.has(rawFolder as AdminEmailFolder)
    ? (rawFolder as AdminEmailFolder)
    : "inbox";

  try {
    const messages = await listAdminInbox(folder);
    return NextResponse.json({ messages, folder });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
