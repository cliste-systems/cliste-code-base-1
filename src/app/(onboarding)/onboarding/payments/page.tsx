import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * v1: Stripe Connect (salon customer payments) was removed from onboarding.
 * Cliste only collects the platform subscription (plan) now, so this step is
 * gated and forwards to the plan step. The route file is kept so existing
 * bookmarks / in-flight wizards don't 404 while the code is retired.
 */
export default function OnboardingPaymentsPage() {
  redirect("/onboarding/plan");
}
