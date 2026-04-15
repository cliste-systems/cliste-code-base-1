"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
    >
      {pending ? "Closing…" : "Mark closed"}
    </button>
  );
}
