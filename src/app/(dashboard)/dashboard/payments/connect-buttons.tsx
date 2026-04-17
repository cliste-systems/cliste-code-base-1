"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import {
  openStripeExpressDashboard,
  startStripeConnectOnboarding,
} from "./actions";

export function ConnectStripeButton({
  label = "Connect Stripe",
}: {
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // This server action redirects to Stripe; no return value.
          await startStripeConnectOnboarding();
        })
      }
    >
      {pending ? "Opening Stripe…" : label}
    </Button>
  );
}

export function OpenStripeDashboardButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await openStripeExpressDashboard();
        })
      }
    >
      {pending ? "Opening…" : "Open Stripe dashboard"}
    </Button>
  );
}
