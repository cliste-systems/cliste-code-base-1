import { NextResponse } from "next/server";

import { checkAdminInboxApiAccess } from "@/lib/admin-inbox-access";
import {
  isAdminEmailIdentityKey,
  listAdminInbox,
  type AdminEmailFolder,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDERS = new Set<AdminEmailFolder>(["inbox", "archived", "sent"]);

export async function GET(request: Request) {
  const access = await checkAdminInboxApiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status },
    );
  }

  const url = new URL(request.url);
  const rawFolder = url.searchParams.get("folder") ?? "inbox";
  const folder = FOLDERS.has(rawFolder as AdminEmailFolder)
    ? (rawFolder as AdminEmailFolder)
    : "inbox";
  const rawIdentity = url.searchParams.get("identity");
  const identity = isAdminEmailIdentityKey(rawIdentity) ? rawIdentity : "hello";

  try {
    const messages = await listAdminInbox(folder, identity);
    return NextResponse.json({ messages, folder, identity });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
