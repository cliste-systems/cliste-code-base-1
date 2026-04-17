import { poolHealthCheck } from "@/lib/phone-pool";
import { requireOnboardingSession } from "@/lib/onboarding-session";

import { WizardStepper } from "../wizard-stepper";

import { PhonePickerForm } from "./phone-picker-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPhonePage() {
  const session = await requireOnboardingSession();

  let availableIE = 0;
  try {
    const health = await poolHealthCheck();
    availableIE = health.availableIE;
  } catch {
    /* service key unavailable — show zero, user can retry */
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper current="phone" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Pick your Cliste number
        </h1>
        <p className="max-w-prose text-sm text-gray-600">
          We'll hand you an Irish mobile number from our pool. That number is
          where your AI receptionist answers — forward your existing salon
          line to it (we'll show you how in the last step) and your clients
          won't notice a thing.
        </p>
      </header>

      <PhonePickerForm
        existingNumber={session.phoneNumber}
        availableIE={availableIE}
      />
    </div>
  );
}
