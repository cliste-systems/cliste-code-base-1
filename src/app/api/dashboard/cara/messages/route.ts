import { NextResponse } from "next/server";

import {
  ensureActiveConversationId,
  isCaraStorageUnavailableError,
  listMessagesAsc,
  rowsToClientPayload,
  verifyConversationAccess,
} from "@/lib/cara-chat-persistence";
import { getOptionalDashboardSession } from "@/lib/dashboard-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("conversationId")?.trim();

  try {
    let conversationId: string;
    if (rawId) {
      const ok = await verifyConversationAccess(
        session.supabase,
        rawId,
        session.organizationId,
        session.user.id,
      );
      if (!ok) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      conversationId = rawId;
    } else {
      conversationId = await ensureActiveConversationId(
        session.supabase,
        session.organizationId,
        session.user.id,
      );
    }

    const rows = await listMessagesAsc(session.supabase, conversationId);
    return NextResponse.json({
      conversationId,
      messages: rowsToClientPayload(rows),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isCaraStorageUnavailableError(msg)) {
      return NextResponse.json(
        {
          code: "cara_memory_unavailable",
          error:
            "Saved chats are not available until the Cara tables exist in Supabase. Open the SQL Editor (or CLI), run the migrations in this project’s supabase/migrations folder, then tap Retry below.",
        },
        { status: 503 },
      );
    }
    console.error("Cara messages GET", e);
    return NextResponse.json(
      { error: "Could not load chats. Try again in a moment." },
      { status: 500 },
    );
  }
}
