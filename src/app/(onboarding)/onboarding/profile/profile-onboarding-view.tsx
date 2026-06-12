"use client";

import { useState } from "react";

import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import type { VerticalId } from "@/lib/verticals";

import { ProfileForm } from "./profile-form";

type Props = {
  businessName: string;
  needsOwnerName: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  defaultVertical: VerticalId | "";
  defaultAddress: string;
  defaultEircode: string;
};

function profileStepHeader(vertical: VerticalId | "") {
  if (vertical === "salon_beauty") {
    return {
      title: "Tell us about your salon",
      description: "A few details so Cara can answer calls the way you would.",
    };
  }

  return {
    title: "Tell us about your business",
    description: "A few details so Cara can answer calls the way you would.",
  };
}

export function ProfileOnboardingView(props: Props) {
  const [vertical, setVertical] = useState<VerticalId | "">(
    props.defaultVertical,
  );
  const header = profileStepHeader(vertical);

  return (
    <OnboardingStepShell
      variant="profile"
      title={header.title}
      description={header.description}
    >
      <ProfileForm
        businessName={props.businessName}
        needsOwnerName={props.needsOwnerName}
        defaultFirstName={props.defaultFirstName}
        defaultLastName={props.defaultLastName}
        defaultAddress={props.defaultAddress}
        defaultEircode={props.defaultEircode}
        vertical={vertical}
        onVerticalChange={setVertical}
      />
    </OnboardingStepShell>
  );
}
