"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

import { ONBOARDING_PROFILE_FIELD_BOX } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  className?: string;
};

/**
 * Compact Turnstile in a glass field — parent should unmount once onSuccess fires
 * so the "Success!" state never sits in the form.
 */
export const AuthTurnstileField = forwardRef<TurnstileInstance, Props>(
  function AuthTurnstileField(
    { siteKey, onSuccess, onExpire, className },
    ref,
  ) {
    return (
      <div
        className={cn(
          ONBOARDING_PROFILE_FIELD_BOX,
          "flex justify-center px-2 py-2",
          className,
        )}
      >
        <Turnstile
          ref={ref}
          siteKey={siteKey}
          onSuccess={onSuccess}
          onExpire={onExpire}
          options={{
            theme: "light",
            size: "compact",
          }}
        />
      </div>
    );
  },
);
