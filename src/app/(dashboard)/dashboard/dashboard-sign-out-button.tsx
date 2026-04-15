"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

import { clearDashboardSessionCookies } from "./actions";

export function DashboardSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearDashboardSessionCookies();
    router.push("/authenticate");
    router.refresh();
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className="group h-auto w-full justify-between rounded-lg px-4 py-2 text-sm font-normal text-gray-500 hover:bg-gray-100/50 hover:text-gray-900"
    >
      <span className="flex items-center gap-3">
        <LogOut
          className="size-[1.125rem] shrink-0 text-gray-400 group-hover:text-gray-900"
          aria-hidden
        />
        {pending ? "Signing out…" : "Log out"}
      </span>
      <kbd className="pointer-events-none flex size-6 items-center justify-center rounded-full bg-gray-200/60 text-xs font-medium text-gray-600">
        N
      </kbd>
    </Button>
  );
}
