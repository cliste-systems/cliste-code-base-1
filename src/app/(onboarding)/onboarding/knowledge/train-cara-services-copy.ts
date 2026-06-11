import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import { detectTradePack } from "./train-cara-trade-topics";

export type ServicesStepCopy = {
  subtitle: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  helper: string;
};

const SALON_PLACEHOLDER_HINT =
  /\b(cut|colour|color|balayage|blow.?dry|highlight|nail|laser|extension)\b/i;

function barberCopy(): ServicesStepCopy {
  return {
    subtitle: "List the cuts and services callers might ask for.",
    primaryLabel: "Cuts and services",
    primaryPlaceholder:
      "Skin fades, scissor cuts, beard trims, hot towel shaves, kids cuts.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do colour, extensions, or walk-ins on Saturdays.",
    helper: "Short list is fine — a few words per item.",
  };
}

function hairSalonCopy(): ServicesStepCopy {
  return {
    subtitle: "List the treatments and services callers might ask for.",
    primaryLabel: "Services you offer",
    primaryPlaceholder:
      "Cuts, colour, highlights, balayage, blow-dries, treatments.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do nails, laser, or walk-in colour appointments.",
    helper: "Short list is fine — a few words per item.",
  };
}

function tradesCopy(businessType: string): ServicesStepCopy {
  const lower = businessType.toLowerCase();
  if (lower.includes("electric")) {
    return {
      subtitle: "List the electrical jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Rewires, fuse boards, fault finding, lighting, emergency callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder:
        "We don't do plumbing, gas work, or alarm systems.",
      helper: "Short list is fine — a few words per item.",
    };
  }
  if (lower.includes("heat") || lower.includes("boiler")) {
    return {
      subtitle: "List the heating jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Boiler repairs, servicing, installs, radiators, no heating callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder: "We don't do oil boilers or gas appliance repairs.",
      helper: "Short list is fine — a few words per item.",
    };
  }
  if (lower.includes("plumb")) {
    return {
      subtitle: "List the plumbing jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Leaks, burst pipes, blocked drains, bathroom installs, emergency callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder:
        "We don't do electrical work, gas safety certs, or full rewires.",
      helper: "Short list is fine — a few words per item.",
    };
  }
  return {
    subtitle: "List the jobs and emergencies callers might mention.",
    primaryLabel: "Work you do",
    primaryPlaceholder:
      "Leaks, boiler repairs, bathroom installs, blocked drains, emergency callouts.",
    secondaryLabel: "Jobs you don't take?",
    secondaryPlaceholder:
      "We don't do electrical work or jobs outside our area.",
    helper: "Short list is fine — a few words per item.",
  };
}

function defaultCopy(businessType: string): ServicesStepCopy {
  const label = businessType.trim();
  return {
    subtitle: label
      ? `List what callers usually ask ${label} for.`
      : "List what callers usually ask you for.",
    primaryLabel: "What you offer",
    primaryPlaceholder: "Add the main things people call about.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't handle requests outside our area or specialty.",
    helper: "Short list is fine — a few words per item.",
  };
}

export function packServicesStepCopy(
  businessType: string,
  niche: string,
): ServicesStepCopy {
  if (niche === "barber") return barberCopy();

  // Trades share niche "hair_salon" in the DB — classify from business type first.
  const packFromType = detectTradePack(businessType);
  if (packFromType === "trades") return tradesCopy(businessType);

  if (niche === "hair_salon" || packFromType === "salon") return hairSalonCopy();

  return defaultCopy(businessType);
}

function shouldUseServicesUiCopy(
  businessType: string,
  ui: OnboardingUiCopy,
): boolean {
  if (detectTradePack(businessType) !== "trades") return true;

  const blob = [
    ui.servicesOfferedPlaceholder,
    ui.servicesNotOfferedPlaceholder,
    ui.servicesStepSubtitle,
  ]
    .filter(Boolean)
    .join(" ");

  return !SALON_PLACEHOLDER_HINT.test(blob);
}

export function resolveServicesStepCopy(input: {
  businessType: string;
  niche: string;
  uiCopy?: OnboardingUiCopy | null;
}): ServicesStepCopy {
  const base = packServicesStepCopy(input.businessType, input.niche);
  const ui = input.uiCopy;

  if (!ui || !shouldUseServicesUiCopy(input.businessType, ui)) {
    return base;
  }

  return {
    subtitle: ui.servicesStepSubtitle?.trim() || base.subtitle,
    primaryLabel: ui.servicesOfferedLabel?.trim() || base.primaryLabel,
    primaryPlaceholder:
      ui.servicesOfferedPlaceholder?.trim() || base.primaryPlaceholder,
    secondaryLabel: ui.servicesNotOfferedLabel?.trim() || base.secondaryLabel,
    secondaryPlaceholder:
      ui.servicesNotOfferedPlaceholder?.trim() || base.secondaryPlaceholder,
    helper: ui.servicesStepHelper?.trim() || base.helper,
  };
}
