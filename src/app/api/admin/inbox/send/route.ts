import { NextResponse } from "next/server";

import { checkAdminInboxApiAccess } from "@/lib/admin-inbox-access";
import {
  isAdminEmailIdentityKey,
  sendNewAdminEmail,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await checkAdminInboxApiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status },
    );
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
