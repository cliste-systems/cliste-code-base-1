"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError?: () => void;
  onReady?: () => void;
};

/**
 * Invisible Turnstile — no checkbox in the form. Challenge runs on execute();
 * Cloudflare only surfaces UI when interaction is required.
 */
export const AuthInvisibleTurnstile = forwardRef<TurnstileInstance, Props>(
  function AuthInvisibleTurnstile(
    { siteKey, onSuccess, onExpire, onError, onReady },
    ref,
  ) {
    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onError={onError}
        onWidgetLoad={onReady}
        options={{
          execution: "execute",
          appearance: "interaction-only",
        }}
        className="sr-only"
      />
    );
  },
);
