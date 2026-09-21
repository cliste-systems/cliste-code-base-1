"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { adminSecondaryButtonClass } from "@/components/admin/admin-interactive";

import { adminCloseSupportTicket } from "../actions";

type CloseSupportButtonProps = {
  ticketId: string;
};

export function CloseSupportButton({ ticketId }: CloseSupportButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await adminCloseSupportTicket(ticketId);
          if (r.ok) router.refresh();
        });
      }}
      className={`${adminSecondaryButtonClass} justify-center rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200`}
    >
      {pending ? "Closing…" : "Mark closed"}
    </button>
  );
}
