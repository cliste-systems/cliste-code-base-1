"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

import { clearAdminSessionCookies } from "../admin-unlock/actions";

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
      className="group inline-flex w-full items-center gap-3 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-left text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100/80 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogOut
        className="size-4 shrink-0 text-gray-500 transition-colors group-hover:text-gray-900"
        aria-hidden
      />
      <span>{pending ? "Signing out..." : "Log out"}</span>
    </button>
  );
}
