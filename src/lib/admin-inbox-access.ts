import "server-only";

import { canAccessAdminConsole } from "@/lib/admin-session";
import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";
import { createClient } from "@/utils/supabase/server";

export type AdminInboxAccessCheck =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 500;
      code: "session_required" | "forbidden" | "mfa_required" | "config_error";
      message: string;
    };

export async function checkAdminInboxApiAccess(): Promise<AdminInboxAccessCheck> {
  // Local shell-only development may run without Supabase auth configured.
  // Production never takes this branch.
  if (allowAdminDevWithoutSupabase()) {
    return { ok: true };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      ok: false,
      status: 500,
      code: "config_error",
      message: "Admin authentication is unavailable.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      code: "session_required",
      message: "An authenticated admin session is required.",
    };
  }

  if (!canAccessAdminConsole(user)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      message: "This account cannot access the admin console.",
    };
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError) {
    return {
      ok: false,
      status: 500,
      code: "config_error",
      message: "Could not verify admin MFA status.",
    };
  }

  if (aal.currentLevel !== "aal2") {
    return {
      ok: false,
      status: 403,
      code: "mfa_required",
      message: "Multi-factor authentication is required for admin inbox access.",
    };
  }

  return { ok: true };
}
