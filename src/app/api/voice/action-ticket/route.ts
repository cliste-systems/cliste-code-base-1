import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "action_inbox_retired",
      error: "Action Inbox has been retired. Use the call record instead.",
    },
    { status: 410 },
  );
}
