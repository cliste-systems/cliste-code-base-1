import { NextResponse } from "next/server";

import { checkAdminInboxApiAccess } from "@/lib/admin-inbox-access";
import {
  getAdminEmailMessage,
  setAdminEmailSenderBlocked,
  setAdminEmailState,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await checkAdminInboxApiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status },
    );
  }

  const { id } = await context.params;
  try {
    const message = await getAdminEmailMessage(decodeURIComponent(id));
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email.";
    const status = message === "Email not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await checkAdminInboxApiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status },
    );
  }

  let body: { read?: boolean; archived?: boolean; blocked?: boolean };
  try {
    body = (await request.json()) as {
      read?: boolean;
      archived?: boolean;
      blocked?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    typeof body.read !== "boolean" &&
    typeof body.archived !== "boolean" &&
    typeof body.blocked !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Provide read, archived or blocked state." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const resendEmailId = decodeURIComponent(id);
  try {
    let senderEmail: string | null = null;
    if (typeof body.blocked === "boolean") {
      const result = await setAdminEmailSenderBlocked({
        resendEmailId,
        blocked: body.blocked,
      });
      senderEmail = result.email;
    }

    if (
      typeof body.read === "boolean" ||
      typeof body.archived === "boolean"
    ) {
      await setAdminEmailState({
        resendEmailId,
        read: body.read,
        archived: body.archived,
      });
    }

    return NextResponse.json({ ok: true, senderEmail });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
