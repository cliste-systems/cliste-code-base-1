import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";

const DEFAULT_ADMIN_EMAIL = "brendan@clistesystems.ie";

function parseAllowedAdminEmails(): Set<string> {
  const raw = process.env.CLISTE_ADMIN_ALLOWED_EMAILS?.trim();
  const values = (raw ? raw.split(",") : [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!values.includes(DEFAULT_ADMIN_EMAIL)) {
    values.push(DEFAULT_ADMIN_EMAIL);
  }
  return new Set(values);
}

function hasConsoleAccessFlag(user: User): boolean {
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  return (
    appMeta?.cliste_admin_console === true ||
    appMeta?.cliste_admin_console === "true"
  );
}

export function isAdminEmailAllowlisted(
  email: string | null | undefined
): boolean {
  const v = email?.trim().toLowerCase();
  if (!v) return false;
  return parseAllowedAdminEmails().has(v);
}

export function canAccessAdminConsole(user: User): boolean {
  return isAdminEmailAllowlisted(user.email) || hasConsoleAccessFlag(user);
}

type ResolveAdminAuth =
  | { tag: "ok"; user: User }
  | { tag: "no_session" }
  | { tag: "forbidden" };

async function resolveAdminAuth(): Promise<ResolveAdminAuth> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { tag: "no_session" };
  if (!canAccessAdminConsole(user)) return { tag: "forbidden" };
  return { tag: "ok", user };
}

export const getOptionalAdminSessionUser = cache(async (): Promise<User | null> => {
  const r = await resolveAdminAuth();
  if (r.tag === "ok") return r.user;
  return null;
});

export const requireAdminSessionUser = cache(async (): Promise<User> => {
  const r = await resolveAdminAuth();
  if (r.tag === "ok") return r.user;
  if (r.tag === "forbidden") {
    redirect(
      "/authenticate?error=forbidden&message=This%20account%20is%20not%20allowed%20to%20access%20Admin."
    );
  }
  redirect(
    "/authenticate?error=admin&message=Sign%20in%20with%20an%20authorized%20Admin%20account."
  );
});
