import { NextResponse } from "next/server";

import { checkAdminInboxApiAccess } from "@/lib/admin-inbox-access";
import { refreshAdminEmailDeliveryStatus } from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const access = await checkAdminInboxApiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: access.status },
    );
  }

  const { id } = await context.params;
  try {
    const delivery = await refreshAdminEmailDeliveryStatus(
      decodeURIComponent(id),
    );
    return NextResponse.json({ ok: true, ...delivery });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not refresh delivery status.";
    const status = message === "Email not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
