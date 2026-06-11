"use client";

import { motion, useReducedMotion } from "motion/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

export function OnboardingLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const reduceMotion = useReducedMotion();

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/authenticate");
    router.refresh();
    setPending(false);
  }

  const className = cn(
    "absolute top-4 right-4 z-20 inline-flex size-9 cursor-pointer items-center justify-center rounded-full",
    "border border-white/60 bg-white/70 text-slate-500 shadow-sm backdrop-blur-sm",
    "transition-colors hover:bg-white hover:text-[#0b1220]",
    pending && "cursor-not-allowed opacity-60",
  );

  if (reduceMotion) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleSignOut()}
        className={className}
        aria-label={pending ? "Signing out" : "Log out"}
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className={className}
      aria-label={pending ? "Signing out" : "Log out"}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.35 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
    >
      <LogOut className="size-4" aria-hidden />
    </motion.button>
  );
}
