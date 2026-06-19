import { redirect } from "next/navigation";

import { isSignupOnboardingDevRelaxed } from "@/lib/onboarding-dev";
import {
  parseMarketingPlanIntent,
} from "@/lib/signup-plan-intent";
import { createClient } from "@/utils/supabase/server";

import { SignupFlow } from "./signup-flow";

export const metadata = {
  title: "Sign up — Cliste Systems",
  description:
    "Create your Cliste account and set up your AI receptionist in under 10 minutes.",
};

type SearchParams = Promise<{
  plan?: string | string[];
  interval?: string | string[];
}>;

export default async function SignupPage(props: { searchParams?: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
