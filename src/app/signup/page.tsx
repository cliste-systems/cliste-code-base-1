import { redirect } from "next/navigation";

import { PRODUCT_NAME } from "@/lib/company-details";
import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";
import {
  parseMarketingPlanIntent,
} from "@/lib/signup-plan-intent";
import { getAuthUserOrNull } from "@/utils/supabase/server";

import { SignupFlow } from "./signup-flow";

export const metadata = {
  title: `Sign up — ${PRODUCT_NAME}`,
  description:
    `Create your ${PRODUCT_NAME} account and set up your AI receptionist in under 10 minutes.`,
};

type SearchParams = Promise<{
  plan?: string | string[];
  interval?: string | string[];
}>;

export const dynamic = "force-dynamic";

export default async function SignupPage(props: { searchParams?: SearchParams }) {
  const user = await getAuthUserOrNull();
  if (user) {
    redirect("/auth/post-login");
  }

  const params = (await props.searchParams) ?? {};
  const intent = parseMarketingPlanIntent(params);

  return (
    <SignupFlow
      planTier={intent.planTier}
      billingInterval={intent.interval}
      skipTurnstile={isSignupOnboardingDevRelaxed()}
    />
  );
}
