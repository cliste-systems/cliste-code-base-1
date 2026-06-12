import { redirect } from "next/navigation";

import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { PLANS } from "@/lib/cliste-plans";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import {
  parseMarketingPlanIntent,
  planIntentLabel,
} from "@/lib/signup-plan-intent";
import { createClient } from "@/utils/supabase/server";

import { SignupForm } from "./signup-form";
import { SignupSignInLink } from "./signup-sign-in-link";

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
  const selectedPlan =
    intent.planTier && PLANS[intent.planTier] ? PLANS[intent.planTier] : null;

  return (
    <AuthMarketingShell
      title="Create your account"
      subtitle="Your AI phone agent for Irish businesses."
      pageBackground={PUBLIC_ASSETS.onboarding.authSignup}
      compact
    >
      <SignupForm
        planTier={intent.planTier}
        billingInterval={intent.interval}
        selectedPlanName={
          selectedPlan ? planIntentLabel(selectedPlan.tier) : null
        }
        selectedPlanPriceCents={
          selectedPlan
            ? intent.interval === "year"
              ? selectedPlan.annualCents
              : selectedPlan.monthlyCents
            : null
        }
        billingIntervalLabel={
          intent.interval === "year" ? "annual" : "monthly"
        }
      />
      <SignupSignInLink />
    </AuthMarketingShell>
  );
}
