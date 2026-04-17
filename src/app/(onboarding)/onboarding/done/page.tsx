import { requireOnboardingSession } from "@/lib/onboarding-session";

import { WizardStepper } from "../wizard-stepper";

import { GoLiveForm } from "./go-live-form";

export const dynamic = "force-dynamic";

export default async function OnboardingDonePage() {
  const session = await requireOnboardingSession();

  const launch = session.launchTier ?? "diy";

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper current="done" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          You&apos;re ready to go live
        </h1>
        <p className="max-w-prose text-sm text-gray-600">
          Test your Cliste number right now — ring{" "}
          <span className="font-mono text-gray-900">
            {session.phoneNumber ?? "(not assigned yet)"}
          </span>{" "}
          from your personal mobile and book a test appointment. When you&apos;re
          happy it sounds right, hit the button below to switch your salon to{" "}
          <strong>live</strong> and start accepting real bookings.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-900">Next step after Go Live</h2>
        {launch === "diy" ? (
          <p>
            We&apos;ll email you per-carrier forwarding instructions right after you
            go live. Forward your existing salon number to your Cliste number
            and your AI is on the job.
          </p>
        ) : (
          <p>
            You&apos;ve opted into{" "}
            <strong>{launch}</strong>{" "}
            launch. Our team will reach out within 1 business day to schedule
            — your subscription is already active, so there&apos;s no rush.
          </p>
        )}
      </div>

      <GoLiveForm />
    </div>
  );
}
