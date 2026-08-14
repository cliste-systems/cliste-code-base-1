import type { CaraGoal } from "@/lib/cara-goal";
import { verticalIdForNiche, type VerticalId } from "@/lib/verticals";

import {
  ABOUT_PLACEHOLDER,
  DEFAULT_DETAILS_TO_COLLECT,
  OPENING_HOURS_PLACEHOLDER,
  SERVICE_AREA_PLACEHOLDER,
  TRAIN_CARA_STEPS,
} from "./train-cara-constants";

type StepCopy = { title: string; subtitle: string; helper: string };

export type TrainCaraVerticalCopy = {
  about: StepCopy;
  hours: StepCopy;
  location: StepCopy;
  capture: StepCopy;
  faqs: StepCopy;
  labels: {
    openingHours: string;
    serviceArea: string;
    detailsToCollect: string;
  };
  placeholders: {
    about: string;
    openingHours: string;
    serviceArea: string;
    detailsToCollect: string;
  };
};

/** Field labels shared by the generic flow (matches the historic wording). */
const GENERIC_LABELS: TrainCaraVerticalCopy["labels"] = {
  openingHours: "Opening hours",
  serviceArea: "Areas covered",
  detailsToCollect: "What to capture on calls",
};

function stepById(id: string): (typeof TRAIN_CARA_STEPS)[number] {
  return TRAIN_CARA_STEPS.find((s) => s.id === id) ?? TRAIN_CARA_STEPS[0];
}

/** Today's universal copy — the fallback for any non-tailored vertical. */
function genericCopy(caraGoal?: CaraGoal): TrainCaraVerticalCopy {
  const about = stepById("about");
  const hours = stepById("hours");
  const location = stepById("location");
  const capture = stepById("capture");
  const faqs = stepById("faqs");
  return {
    about: {
      title: "Tell Cara about your business",
      subtitle: "Who you are, what you do, and who you help.",
      helper: about.helper,
    },
    hours: { title: hours.title, subtitle: hours.subtitle, helper: hours.helper },
    location: {
      title: location.title,
      subtitle: location.subtitle,
      helper: location.helper,
    },
    capture: {
      title:
        caraGoal === "faq_only"
          ? "What Cara should capture on calls"
          : capture.title,
      subtitle:
        caraGoal === "faq_only"
          ? "What to note when someone needs a callback."
          : capture.subtitle,
      helper: capture.helper,
    },
    faqs: { title: faqs.title, subtitle: faqs.subtitle, helper: faqs.helper },
    labels: GENERIC_LABELS,
    placeholders: {
      about: ABOUT_PLACEHOLDER,
      openingHours: OPENING_HOURS_PLACEHOLDER,
      serviceArea: SERVICE_AREA_PLACEHOLDER,
      detailsToCollect: DEFAULT_DETAILS_TO_COLLECT,
    },
  };
}

function salonCopy(caraGoal?: CaraGoal): TrainCaraVerticalCopy {
  return {
    about: {
      title: "Tell Cara about your salon",
      subtitle: "Who you are, the vibe of the salon, and the clients you look after.",
      helper: "Write it like you're showing a new stylist the ropes.",
    },
    hours: {
      title: "When are you open?",
      subtitle: "Your opening days and times — Cara shares these when callers ask.",
      helper: "Tap a day, then mark it open and set your times.",
    },
    location: {
      title: "Where is the salon?",
      subtitle: "Street, town, county, and Eircode — callers ask about this all the time.",
      helper: "Same fields as Cara Setup in your dashboard.",
    },
    capture: {
      title:
        caraGoal === "faq_only"
          ? "What Cara should capture on calls"
          : "What should Cara get from each caller?",
      subtitle:
        caraGoal === "faq_only"
          ? "What to note when someone needs a callback."
          : "Preferences Cara should note when someone wants to book or follow up.",
      helper: "Pick the details that fit — Cara only asks when it makes sense on the call.",
    },
    faqs: {
      title: "What do clients always ask?",
      subtitle: "Pick a common question or add your own.",
      helper: "Short answers work best — you can refine them later.",
    },
    labels: {
      openingHours: "Opening hours",
      serviceArea: "Town (for location answers)",
      detailsToCollect: "What to capture on calls",
    },
    placeholders: {
      about:
        "Tell Cara about the salon — your treatments, your style, who you look after, and what makes you different. The more detail, the more natural she sounds.",
      openingHours:
        "Tue–Fri 9am–7pm, Sat 9am–5pm, late night Thursday, closed Sun–Mon.",
      serviceArea: "e.g. Sligo — clients come to you; Cara won't describe a coverage area.",
      detailsToCollect:
        caraGoal === "faq_only"
          ? "Name, phone number, what they need, and when to call back."
          : "Preferred service, preferred day, stylist preference.",
    },
  };
}

export type TrainCaraIntroCopy = {
  headlineLines: string[];
  subheadline: string;
};

const TRAIN_CARA_INTRO_COPY: Record<VerticalId, TrainCaraIntroCopy> = {
  salon_beauty: {
    headlineLines: ["Train Cara like a new stylist starting on the front desk."],
    subheadline:
      "The more Cara knows about the salon — your treatments, your regulars, your policies — the better she'll handle real calls.",
  },
  retail: {
    headlineLines: ["Train Cara like someone new on the shop phone."],
    subheadline:
      "The more Cara knows about the store — hours, departments, and what you never guess — the better she'll handle real calls.",
  },
  generic: {
    headlineLines: [
      "Train Cara like someone you're putting",
      "on the phone tomorrow.",
    ],
    subheadline:
      "Treat the next sections like onboarding a new employee. The more Cara knows about your business, the better she'll handle real calls.",
  },
};

const TRAIN_CARA_VERTICAL_COPY: Record<
  VerticalId,
  (caraGoal?: CaraGoal) => TrainCaraVerticalCopy
> = {
  salon_beauty: salonCopy,
  retail: genericCopy,
  generic: genericCopy,
};

/** Train Cara intro hero copy tailored to the org's vertical. */
export function trainCaraIntroCopy(
  niche: string | null | undefined,
): TrainCaraIntroCopy {
  return TRAIN_CARA_INTRO_COPY[verticalIdForNiche(niche)];
}

/** Train Cara step copy + placeholders tailored to the org's vertical. */
export function trainCaraVerticalCopy(
  niche: string | null | undefined,
  caraGoal?: CaraGoal,
): TrainCaraVerticalCopy {
  return TRAIN_CARA_VERTICAL_COPY[verticalIdForNiche(niche)](caraGoal);
}
