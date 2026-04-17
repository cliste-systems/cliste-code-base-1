"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Lives on the booking success page while we are waiting for Stripe's webhook
 * to land. The success page is server-rendered (force-dynamic), so we just
 * call `router.refresh()` on a backoff and let the server re-read
 * `appointments.payment_status`. Once we transition out of "processing" the
 * server-rendered status will stop returning this component and polling ends.
 *
 * We cap polling at ~30s to avoid hammering the DB if the webhook is delayed.
 */
export function BookingStatusAutoRefresh() {
  const router = useRouter();
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tick = (delayMs: number) => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        router.refresh();
        const elapsed = Date.now() - startRef.current;
        if (elapsed > 30_000) return; // give up after ~30s
        const next = Math.min(delayMs * 1.4, 5_000);
        tick(next);
      }, delayMs);
    };

    tick(2_000);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
