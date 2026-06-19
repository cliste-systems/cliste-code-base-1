import "server-only";

import { resolveCheckoutReturnOrigin } from "@/lib/platform-billing-checkout";
import { createPlatformElementsCheckout } from "@/lib/platform-billing-elements";
import { isDevOnboardingPreviewEnabled } from "@/lib/onboarding-dev";

export type DevElementsCheckoutResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      returnUrl: string;
      summary: {
        planName: string;
        trialDays: number;
        amountLabel: string;
        intervalLabel: string;
        email: string;
      };
    }
  | { ok: false; message: string };

export async function prepareDevElementsCheckoutPreview(): Promise<DevElementsCheckoutResult> {
  if (!isDevOnboardingPreviewEnabled()) {
    return { ok: false, message: "Dev preview is not enabled." };
  }

  const origin = await resolveCheckoutReturnOrigin();
  const result = await createPlatformElementsCheckout({
    planTier: "pro",
    launchTier: "diy",
    interval: "month",
    userEmail: "dev-preview@cliste.local",
    devPreview: true,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    clientSecret: result.clientSecret,
    subscriptionId: result.subscriptionId,
    returnUrl: `${origin}/dev/onboarding/plan?status=preview`,
    summary: result.summary,
  };
}
