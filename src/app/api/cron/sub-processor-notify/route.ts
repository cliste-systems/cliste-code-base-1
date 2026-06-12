import { NextResponse } from "next/server";

import { notifySubProcessorListChangeIfNeeded } from "@/lib/sub-processor-notifications";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export const dynamic = "force-dynamic";

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const token = bearer ?? header ?? "";
  if (!token) return false;
  return timingSafeEqualUtf8(token, secret);
}

/** Daily job — email salon admins when SUB_PROCESSOR_LIST_VERSION changes (DPA §7). */
export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifySubProcessorListChangeIfNeeded();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/sub-processor-notify]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Notify failed",
      },
      { status: 500 },
    );
  }
}
