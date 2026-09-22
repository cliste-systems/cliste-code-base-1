import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  isAdminEmailIdentityKey,
  sendNewAdminEmail,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    to?: string;
    subject?: string;
    text?: string;
    identity?: string;
  };
  try {
    body = (await request.json()) as {
      to?: string;
      subject?: string;
      text?: string;
      identity?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await sendNewAdminEmail({
      to: body.to ?? "",
      subject: body.subject ?? "",
      text: body.text ?? "",
      identity: isAdminEmailIdentityKey(body.identity) ? body.identity : "hello",
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
