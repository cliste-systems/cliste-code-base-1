import { verticalIdForNiche } from "@/lib/verticals";

import {
  ABOUT_PLACEHOLDER,
  DEFAULT_DETAILS_TO_COLLECT,
  OPENING_HOURS_PLACEHOLDER,
  RULES_PLACEHOLDER,
  SERVICE_AREA_PLACEHOLDER,
  TRAIN_CARA_STEPS,
} from "./train-cara-constants";

type StepCopy = { title: string; subtitle: string; helper: string };

export type TrainCaraVerticalCopy = {
  about: StepCopy;
  hours: StepCopy;
  capture: StepCopy;
  faqs: StepCopy;
  labels: {
    openingHours: string;
    serviceArea: string;
    detailsToCollect: string;
    rules: string;
  };
  placeholders: {
    about: string;
    openingHours: string;
    serviceArea: string;
    detailsToCollect: string;
    rules: string;
  };
};

/** Field labels shared by the generic flow (matches the historic wording). */
const GENERIC_LABELS: TrainCaraVerticalCopy["labels"] = {
  openingHours: "Opening hours",
  serviceArea: "Areas covered",
  detailsToCollect: "Details to collect",
  rules: "Important rules",
};

function stepById(id: string): (typeof TRAIN_CARA_STEPS)[number] {
  return TRAIN_CARA_STEPS.find((s) => s.id === id) ?? TRAIN_CARA_STEPS[0];
}

/** Today's universal copy — the fallback for any non-tailored vertical. */
function genericCopy(): TrainCaraVerticalCopy {
  const about = stepById("about");
  const hours = stepById("hours");
  const capture = stepById("capture");
  const faqs = stepById("faqs");
  return {
    // About title/subtitle historically came from resolveAboutStepCopy().
    about: {
      title: "Tell Cara about your business",
      subtitle: "Who you are, what you do, and who you help.",
      helper: about.helper,
    },
    hours: { title: hours.title, subtitle: hours.subtitle, helper: hours.helper },
    capture: {
      title: capture.title,
      subtitle: capture.subtitle,
      helper: capture.helper,
    },
    faqs: { title: faqs.title, subtitle: faqs.subtitle, helper: faqs.helper },
    labels: GENERIC_LABELS,
    placeholders: {
      about: ABOUT_PLACEHOLDER,
      openingHours: OPENING_HOURS_PLACEHOLDER,
      serviceArea: SERVICE_AREA_PLACEHOLDER,
      detailsToCollect: DEFAULT_DETAILS_TO_COLLECT,
      rules: RULES_PLACEHOLDER,
    },
  };
}

const SALON_COPY: TrainCaraVerticalCopy = {
  about: {
    title: "Tell Cara about your salon",
    subtitle: "Who you are, the vibe of the salon, and the clients you look after.",
    helper: "Write it like you're showing a new stylist the ropes.",
  },
  hours: {
    title: "When are you open, and where are you?",
    subtitle:
      "Your opening hours, late nights, and where the salon is — Cara shares this with callers.",
    helper: "Plain language is perfect — Cara reads this out on calls.",
  },
  capture: {
    title: "What should Cara get from each caller?",
    subtitle:
      "The details to take for a booking, and the salon rules Cara should always follow.",
    helper: "Write both in plain English — Cara uses them on every call.",
  },
  faqs: {
    title: "What do clients always ask?",
    subtitle: "Pick a common question or add your own.",
    helper: "Short answers work best — you can refine them later.",
  },
  labels: {
    openingHours: "Opening hours",
    serviceArea: "Where you're based",
    detailsToCollect: "Details to take for a booking",
    rules: "Salon rules",
  },
  placeholders: {
    about:
      "Tell Cara about the salon — your treatments, your style, who you look after, and what makes you different. The more detail, the more natural she sounds.",
    openingHours:
      "Tue–Fri 9am–7pm, Sat 9am–5pm, late night Thursday, closed Sun–Mon.",
    serviceArea:
      "Where the salon is, plus any nearby towns clients travel from.",
    detailsToCollect:
      "Name, phone number, the service they want, and their preferred day or stylist.",
    rules:
      "e.g. 48 hours notice to cancel, deposit needed for colour, no walk-ins on Saturdays, patch test before a first tint.",
  },
};

/** Train Cara step copy + placeholders tailored to the org's vertical. */
export function trainCaraVerticalCopy(
  niche: string | null | undefined,
): TrainCaraVerticalCopy {
  return verticalIdForNiche(niche) === "salon_beauty"
    ? SALON_COPY
    : genericCopy();
}
