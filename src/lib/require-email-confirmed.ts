import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

/**
 * Production signups require a confirmed email before onboarding/dashboard.
 * Dev keeps instant access for local iteration.
 */
export function redirectIfEmailUnconfirmed(user: User): void {
  if (process.env.NODE_ENV !== "production") return;
  if (user.email_confirmed_at) return;
  const email = user.email?.trim() ?? "";
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  redirect(`/signup/check-email${query}`);
}
