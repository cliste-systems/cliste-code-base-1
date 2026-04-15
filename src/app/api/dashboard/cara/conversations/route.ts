import { NextResponse } from "next/server";

import {
  createConversationWithWelcome,
  deleteAllCaraConversationsForUser,
  deleteCaraConversationForUser,
  isCaraStorageUnavailableError,
  listMessagesAsc,
  listRecentConversations,
  rowsToClientPayload,
} from "@/lib/cara-chat-persistence";
import { getOptionalDashboardSession } from "@/lib/dashboard-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listRecentConversations(
    session.supabase,
    session.organizationId,
    session.user.id,
  );

  return NextResponse.json({ conversations });
}

export async function POST() {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId } = await createConversationWithWelcome(
      session.supabase,
      session.organizationId,
      session.user.id,
    );
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
            "Saved chats are not available until the Cara tables exist in Supabase. Run this repo’s supabase/migrations in your project, then try again.",
        },
        { status: 503 },
      );
    }
    console.error("Cara new conversation", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create chat" },
      { status: 500 },
    );
  }
}

/**
 * Delete one chat: `?conversationId=uuid&currentConversationId=uuid` (current optional — when it matches the deleted id, response includes the next thread).
 * Delete everything: `?all=1` (always returns a fresh welcome thread).
 */
export async function DELETE(request: Request) {
  const session = await getOptionalDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const all =
    searchParams.get("all") === "1" ||
    searchParams.get("all") === "true" ||
    searchParams.get("all") === "yes";

  const currentConversationId =
    searchParams.get("currentConversationId")?.trim() || null;

  const respondWithFreshThread = async () => {
    const { conversationId } = await createConversationWithWelcome(
      session.supabase,
      session.organizationId,
      session.user.id,
    );
    const rows = await listMessagesAsc(session.supabase, conversationId);
    const conversations = await listRecentConversations(
      session.supabase,
      session.organizationId,
      session.user.id,
    );
    return NextResponse.json({
      conversations,
      conversationId,
      messages: rowsToClientPayload(rows),
    });
  };

  if (all) {
    const { error } = await deleteAllCaraConversationsForUser(
      session.supabase,
      session.organizationId,
      session.user.id,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    try {
      return await respondWithFreshThread();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isCaraStorageUnavailableError(msg)) {
        return NextResponse.json(
          {
            code: "cara_memory_unavailable",
            error:
              "Saved chats are not available until the Cara tables exist in Supabase. Run this repo’s supabase/migrations in your project, then try again.",
          },
          { status: 503 },
        );
      }
      console.error("Cara delete all / recreate", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not reset chats" },
        { status: 500 },
      );
    }
  }

  const conversationId = searchParams.get("conversationId")?.trim();
  if (!conversationId) {
    return NextResponse.json(
      { error: "Expected conversationId or all=1" },
      { status: 400 },
    );
  }

  const del = await deleteCaraConversationForUser(
    session.supabase,
    session.organizationId,
    session.user.id,
    conversationId,
  );
  if (!del.ok) {
    const status = del.error === "Conversation not found." ? 404 : 500;
    return NextResponse.json({ error: del.error }, { status });
  }

  const conversations = await listRecentConversations(
    session.supabase,
    session.organizationId,
    session.user.id,
  );

  if (currentConversationId && currentConversationId === conversationId) {
    try {
      if (conversations.length > 0) {
        const nextId = conversations[0]!.id;
        const rows = await listMessagesAsc(session.supabase, nextId);
        return NextResponse.json({
          conversations,
          conversationId: nextId,
          messages: rowsToClientPayload(rows),
        });
      }
      return await respondWithFreshThread();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isCaraStorageUnavailableError(msg)) {
        return NextResponse.json(
          {
            code: "cara_memory_unavailable",
            error:
              "Saved chats are not available until the Cara tables exist in Supabase. Run this repo’s supabase/migrations in your project, then try again.",
          },
          { status: 503 },
        );
      }
      console.error("Cara delete / switch thread", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not open the next chat" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ conversations });
}
