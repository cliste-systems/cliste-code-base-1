"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError?: () => void;
};

/**
 * Turnstile with interaction-only appearance — no inline checkbox for most users.
 * Cloudflare only surfaces UI when a manual challenge is required.
 */
export const AuthInvisibleTurnstile = forwardRef<TurnstileInstance, Props>(
  function AuthInvisibleTurnstile(
    { siteKey, onSuccess, onExpire, onError },
    ref,
  ) {
    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onError={onError}
        options={{
          theme: "light",
          appearance: "interaction-only",
        }}
      />
    );
  },
);
