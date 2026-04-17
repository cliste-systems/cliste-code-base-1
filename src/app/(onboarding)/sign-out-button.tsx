"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
