"use client";

import dynamic from "next/dynamic";

const StripeEmbeddedCheckout = dynamic(
  () =>
    import("@/components/billing/stripe-embedded-checkout").then(
      (mod) => mod.StripeEmbeddedCheckout,
    ),
  { ssr: false },
);

export function LazyStripeEmbeddedCheckout({
  clientSecret,
}: {
  clientSecret: string;
}) {
  return <StripeEmbeddedCheckout clientSecret={clientSecret} />;
}
