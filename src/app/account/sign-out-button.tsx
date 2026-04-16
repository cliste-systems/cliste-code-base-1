"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { signOutClient } from "./actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOutClient();
          router.replace("/");
          router.refresh();
        });
      }}
      className="text-xs tracking-widest text-zinc-500 uppercase transition-colors hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
