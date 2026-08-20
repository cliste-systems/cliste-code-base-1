"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

import { clearAdminSessionCookies } from "../admin/login/actions";

export function AdminSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearAdminSessionCookies();
    router.push("/authenticate");
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className="group inline-flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogOut
        className="size-4 shrink-0 text-gray-500 transition-colors group-hover:text-gray-900"
        aria-hidden
      />
      <span>{pending ? "Signing out..." : "Log out"}</span>
    </button>
  );
}
