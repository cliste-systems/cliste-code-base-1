import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  getAdminEmailMessage,
  setAdminEmailState,
} from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { read?: boolean; archived?: boolean };
  try {
    body = (await request.json()) as { read?: boolean; archived?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    typeof body.read !== "boolean" &&
    typeof body.archived !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Provide read or archived state." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    await setAdminEmailState({
      resendEmailId: decodeURIComponent(id),
      read: body.read,
      archived: body.archived,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
