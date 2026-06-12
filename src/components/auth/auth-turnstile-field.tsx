"use client";

import { Turnstile } from "@marsidev/react-turnstile";

import { ONBOARDING_PROFILE_FIELD_BOX } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

type Props = {
  siteKey: string;
  token: string | null;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  className?: string;
};

/** Turnstile wrapped to match onboarding glass field styling. */
export function AuthTurnstileField({
  siteKey,
  token,
  onSuccess,
  onExpire,
  className,
}: Props) {
  return (
    <div
      className={cn(
        ONBOARDING_PROFILE_FIELD_BOX,
        "flex min-h-0 items-center justify-center overflow-hidden px-2 py-1",
        "[&_iframe]:rounded-lg",
        className,
      )}
    >
      <input type="hidden" name="turnstileToken" value={token ?? ""} />
      <Turnstile
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
}
