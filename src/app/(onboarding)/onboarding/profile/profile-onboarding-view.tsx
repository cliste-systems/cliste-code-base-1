"use client";

import { useState } from "react";

import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import type { CaraGoal } from "@/lib/cara-goal";
import { VERTICAL_PACKS, type VerticalId } from "@/lib/verticals";

import { ProfileForm } from "./profile-form";

type Props = {
  businessName: string;
  needsOwnerName: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  defaultVertical: VerticalId | "";
  defaultCaraGoal: CaraGoal | "";
  defaultAddress: string;
  defaultEircode: string;
};

function profileStepHeader(vertical: VerticalId | "") {
  const pack =
    vertical && vertical in VERTICAL_PACKS
      ? VERTICAL_PACKS[vertical]
      : VERTICAL_PACKS.generic;

  return {
    title: pack.onboarding.profileHeaderTitle,
    description: pack.onboarding.profileHeaderSubtitle,
  };
}

export function ProfileOnboardingView(props: Props) {
  const [vertical, setVertical] = useState<VerticalId | "">(
    props.defaultVertical,
  );
  const [caraGoal, setCaraGoal] = useState<CaraGoal | "">(props.defaultCaraGoal);
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
        caraGoal={caraGoal}
        onCaraGoalChange={setCaraGoal}
      />
    </OnboardingStepShell>
  );
}
