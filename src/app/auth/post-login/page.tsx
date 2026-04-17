import { redirect } from "next/navigation";

import { canAccessAdminConsole } from "@/lib/admin-session";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function PostLoginRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/authenticate");
  }

  if (canAccessAdminConsole(user)) {
    redirect("/admin");
  }

  // Gate on the salon's lifecycle. SaaS signups land here while still
  // onboarding (status != 'active') and are routed into the wizard so they
  // can't poke around a half-configured dashboard.
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("status")
      .eq("id", profile.organization_id)
      .maybeSingle();
    const status = (org?.status as string | undefined) ?? "active";
    if (status === "pending_verification" || status === "onboarding") {
      redirect("/onboarding");
    }
    if (status === "suspended") {
      redirect("/dashboard/billing?suspended=1");
    }
  }

  redirect("/dashboard");
}
