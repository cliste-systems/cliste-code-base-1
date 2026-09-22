import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { refreshAdminEmailDeliveryStatus } from "@/lib/resend-admin-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
