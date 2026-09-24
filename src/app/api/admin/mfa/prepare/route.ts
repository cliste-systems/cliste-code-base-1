import { NextResponse } from "next/server";

import { canAccessAdminConsole } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_MFA_FRIENDLY_NAME = "Cliste Systems Admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Admin sign-in is required.", code: "session_required" },
      { status: 401 },
    );
  }

  if (!canAccessAdminConsole(user)) {
    return NextResponse.json(
      { error: "This account cannot access the admin console." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not inspect existing MFA factors." },
      { status: 500 },
    );
  }

  const factors = data?.factors ?? [];
  const stale = factors.filter(
    (factor) =>
      factor.status === "unverified" &&
      factor.factor_type === "totp" &&
      factor.friendly_name === ADMIN_MFA_FRIENDLY_NAME,
  );

  for (const factor of stale) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factor.id,
    });

    if (deleteError) {
      console.warn("[admin-mfa] stale_factor_cleanup_failed", {
        factorId: factor.id,
        message: deleteError.message,
      });
      continue;
    }
  }

  return NextResponse.json({ ok: true, removed: stale.length });
}
