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

  redirect("/dashboard");
}
