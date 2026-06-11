"use client";

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

import { getStripeJs } from "@/lib/stripe-publishable";

type Props = {
  clientSecret: string;
};

export function StripeEmbeddedCheckout({ clientSecret }: Props) {
  return (
    <EmbeddedCheckoutProvider
      stripe={getStripeJs()}
      options={{ clientSecret }}
    >
      <EmbeddedCheckout className="min-h-[480px] w-full" />
    </EmbeddedCheckoutProvider>
  );
}
