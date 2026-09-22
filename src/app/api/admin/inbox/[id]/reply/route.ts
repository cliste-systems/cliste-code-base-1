import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { replyToAdminEmail } from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Reply cannot be empty." }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const result = await replyToAdminEmail({
      resendEmailId: decodeURIComponent(id),
      text,
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
