import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import { verticalPackForNiche } from "@/lib/verticals";

export type ExclusionsStepCopy = {
  subtitle: string;
  placeholder: string;
  helper: string;
  previewLabel: string;
};

export type ServicesStepCopy = {
  subtitle: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  helper: string;
  catalogListLabel: string;
  plainEnglishLabel: string;
  plainEnglishOptionalPlaceholder: string;
  bookingImportLabel?: string;
  bookingImportHint?: string;
  bookingImportPlaceholder?: string;
};

const SALON_PLACEHOLDER_HINT =
  /\b(cut|colour|color|balayage|blow.?dry|highlight|nail|laser|extension)\b/i;

function salonBookingImportFields(): Pick<
  ServicesStepCopy,
  "bookingImportLabel" | "bookingImportHint" | "bookingImportPlaceholder"
> {
  return {
    bookingImportLabel: "Import from booking link",
    bookingImportHint:
      "Paste Fresha, Phorest, or Booksy — or add services manually with Add.",
    bookingImportPlaceholder: "fresha.com/… or booksy.com/…",
  };
}

function salonPlainEnglishFields(): Pick<
  ServicesStepCopy,
  "catalogListLabel" | "plainEnglishLabel" | "plainEnglishOptionalPlaceholder"
> {
  return {
    catalogListLabel: "Service menu",
    plainEnglishLabel: "Or describe your services in your own words",
    plainEnglishOptionalPlaceholder:
      "Anything callers ask about that isn't in your menu above.",
  };
}

function barberCopy(): ServicesStepCopy {
  return {
    ...salonBookingImportFields(),
    ...salonPlainEnglishFields(),
    subtitle: "Add cuts and services callers might ask for.",
    primaryLabel: "Cuts and services",
    primaryPlaceholder:
      "Skin fades, scissor cuts, beard trims, hot towel shaves, kids cuts.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do colour, extensions, or walk-ins on Saturdays.",
    helper: "",
  };
}

function hairSalonCopy(): ServicesStepCopy {
  return {
    ...salonBookingImportFields(),
    ...salonPlainEnglishFields(),
    subtitle: "Add services callers might ask for.",
    primaryLabel: "Services you offer",
    primaryPlaceholder:
      "Cuts, colour, highlights, balayage, blow-dries, treatments.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do nails, laser, or walk-in colour appointments.",
    helper: "",
  };
}

function beautyCopy(): ServicesStepCopy {
  return {
    ...salonBookingImportFields(),
    ...salonPlainEnglishFields(),
    subtitle: "Add services callers might ask for.",
    primaryLabel: "Services you offer",
    primaryPlaceholder:
      "Gel manicures, nail art, lash lifts, brow tints, infills, extensions.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do hair services, walk-in colour, or laser treatments.",
    helper: "",
  };
}

function tradesCopy(businessType: string): ServicesStepCopy {
  const lower = businessType.toLowerCase();
  const plainEnglishFields = {
    catalogListLabel: "Work you do",
    plainEnglishLabel: "Describe the jobs you take in your own words",
    plainEnglishOptionalPlaceholder:
      "Other work callers mention that you didn't list above.",
  };
  if (lower.includes("electric")) {
    return {
      ...plainEnglishFields,
      subtitle: "List the electrical jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Rewires, fuse boards, fault finding, lighting, emergency callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder:
        "We don't do plumbing, gas work, or alarm systems.",
      helper: "",
    };
  }
  if (lower.includes("heat") || lower.includes("boiler")) {
    return {
      ...plainEnglishFields,
      subtitle: "List the heating jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Boiler repairs, servicing, installs, radiators, no heating callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder: "We don't do oil boilers or gas appliance repairs.",
      helper: "",
    };
  }
  if (lower.includes("plumb")) {
    return {
      ...plainEnglishFields,
      subtitle: "List the plumbing jobs callers might mention.",
      primaryLabel: "Jobs you take",
      primaryPlaceholder:
        "Leaks, burst pipes, blocked drains, bathroom installs, emergency callouts.",
      secondaryLabel: "Jobs you don't take?",
      secondaryPlaceholder:
        "We don't do electrical work, gas safety certs, or full rewires.",
      helper: "",
    };
  }
  return {
    ...plainEnglishFields,
    subtitle: "List the jobs and emergencies callers might mention.",
    primaryLabel: "Work you do",
    primaryPlaceholder:
      "Leaks, boiler repairs, bathroom installs, blocked drains, emergency callouts.",
    secondaryLabel: "Jobs you don't take?",
    secondaryPlaceholder:
      "We don't do electrical work or jobs outside our area.",
    helper: "",
  };
}

function hospitalityCopy(businessType: string): ServicesStepCopy {
  const lower = businessType.toLowerCase();
  const isCafe = /\b(cafe|café|coffee|bakery|bistro|brunch)\b/.test(lower);
  return {
    catalogListLabel: isCafe ? "Menu" : "What you offer",
    plainEnglishLabel: isCafe
      ? "Describe your menu in your own words"
      : "Describe what you serve in your own words",
    plainEnglishOptionalPlaceholder:
      "Anything callers ask about that you didn't list above.",
    subtitle: isCafe
      ? "List drinks, food, and things callers might ask about."
      : "List dishes, bookings, and things callers might ask about.",
    primaryLabel: isCafe ? "Food and drinks" : "What you offer",
    primaryPlaceholder: isCafe
      ? "Flat whites, pastries, sandwiches, brunch plates, dietary options."
      : "Lunch menu, dinner reservations, takeaway, private dining, dietary options.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't do table bookings on the phone, catering, or delivery.",
    helper: "",
  };
}

function isHospitalityBusiness(businessType: string): boolean {
  return /\b(cafe|café|coffee|restaurant|bistro|bakery|brunch|bar|pub|hotel|hospitality|food)\b/i.test(
    businessType,
  );
}

function defaultCopy(businessType: string): ServicesStepCopy {
  const label = businessType.trim();
  return {
    catalogListLabel: "What you offer",
    plainEnglishLabel: "Describe what callers usually ask for",
    plainEnglishOptionalPlaceholder:
      "Anything else callers mention that you didn't list above.",
    subtitle: label
      ? `List what callers usually ask ${label} for.`
      : "List what callers usually ask you for.",
    primaryLabel: "What you offer",
    primaryPlaceholder: "Add the main things people call about.",
    secondaryLabel: "Anything you don't offer?",
    secondaryPlaceholder:
      "We don't handle anything outside what we offer.",
    helper: "",
  };
}

export function packServicesStepCopy(
  businessType: string,
  niche: string,
): ServicesStepCopy {
  if (!verticalPackForNiche(niche).capabilities.usesServiceCatalog) {
    if (isHospitalityBusiness(businessType)) {
      return hospitalityCopy(businessType);
    }
    return defaultCopy(businessType);
  }
  if (niche === "barber") return barberCopy();
  if (niche === "beauty") return beautyCopy();
  return hairSalonCopy();
}

function shouldUseServicesUiCopy(
  niche: string,
  ui: OnboardingUiCopy,
): boolean {
  if (!verticalPackForNiche(niche).capabilities.usesServiceCatalog) return true;

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

  if (!ui || !shouldUseServicesUiCopy(input.niche, ui)) {
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
    catalogListLabel: base.catalogListLabel,
    plainEnglishLabel: base.plainEnglishLabel,
    plainEnglishOptionalPlaceholder: base.plainEnglishOptionalPlaceholder,
  };
}

function salonExclusionsCopy(): ExclusionsStepCopy {
  return {
    subtitle:
      "Write like you'd tell a new stylist — Cara picks out what she must never agree to.",
    placeholder:
      "We don't take walk-ins, do hair or laser, and we don't offer same-day colour.",
    helper: "Plain English is fine — Cara extracts the list she needs.",
    previewLabel: "Cara won't agree to",
  };
}

function barberExclusionsCopy(): ExclusionsStepCopy {
  return {
    subtitle:
      "Write like you'd tell a new barber — Cara picks out what she must never agree to.",
    placeholder:
      "We don't do colour, extensions, or walk-ins on Saturdays.",
    helper: "Plain English is fine — Cara extracts the list she needs.",
    previewLabel: "Cara won't agree to",
  };
}

function tradesExclusionsCopy(businessType: string): ExclusionsStepCopy {
  const lower = businessType.toLowerCase();
  if (lower.includes("electric")) {
    return {
      subtitle: "Jobs and requests you never take — write normally.",
      placeholder:
        "We don't do plumbing, gas work, alarm systems, or jobs outside our area.",
      helper: "Plain English is fine — Cara extracts the list she needs.",
      previewLabel: "Cara won't take",
    };
  }
  if (lower.includes("heat") || lower.includes("boiler")) {
    return {
      subtitle: "Jobs and requests you never take — write normally.",
      placeholder:
        "We don't do oil boilers, gas appliance repairs, or electrical work.",
      helper: "Plain English is fine — Cara extracts the list she needs.",
      previewLabel: "Cara won't take",
    };
  }
  if (lower.includes("plumb")) {
    return {
      subtitle: "Jobs and requests you never take — write normally.",
      placeholder:
        "We don't do electrical work, gas safety certs, or full rewires.",
      helper: "Plain English is fine — Cara extracts the list she needs.",
      previewLabel: "Cara won't take",
    };
  }
  return {
    subtitle: "Jobs and requests you never take — write normally.",
    placeholder:
      "We don't do electrical work, gas, or jobs outside our coverage area.",
    helper: "Plain English is fine — Cara extracts the list she needs.",
    previewLabel: "Cara won't take",
  };
}

function defaultExclusionsCopy(): ExclusionsStepCopy {
  return {
    subtitle:
      "Write like you'd tell a new team member — Cara picks out what she must never agree to.",
    placeholder:
      "We don't handle anything outside what we listed on the last step.",
    helper: "Plain English is fine — Cara extracts the list she needs.",
    previewLabel: "Cara won't agree to",
  };
}

export function packExclusionsStepCopy(
  businessType: string,
  niche: string,
): ExclusionsStepCopy {
  if (!verticalPackForNiche(niche).capabilities.usesServiceCatalog) {
    return tradesExclusionsCopy(businessType);
  }
  if (niche === "barber") return barberExclusionsCopy();
  return salonExclusionsCopy();
}

export function resolveExclusionsStepCopy(input: {
  businessType: string;
  niche: string;
  servicesCopy: ServicesStepCopy;
}): ExclusionsStepCopy {
  const base = packExclusionsStepCopy(input.businessType, input.niche);
  return {
    subtitle: base.subtitle,
    placeholder:
      input.servicesCopy.secondaryPlaceholder?.trim() || base.placeholder,
    helper: base.helper,
    previewLabel: base.previewLabel,
  };
}
