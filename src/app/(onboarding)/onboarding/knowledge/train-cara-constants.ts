export const TRAIN_CARA_STEPS = [
  {
    id: "about",
    label: "About",
    title: "Tell Cara about your business",
    subtitle:
      "Describe who you are, what you do, who you help, and the kind of business you run.",
    helper: "Write this like you're explaining the business to a new employee.",
    progressLabel: "About the business",
  },
  {
    id: "services",
    label: "Services",
    title: "What you offer",
    subtitle: "Import or add the treatments and services callers ask about.",
    helper: "Short list is fine — a few words per item.",
    progressLabel: "Services offered",
  },
  {
    id: "exclusions",
    label: "Exclusions",
    title: "What you don't offer",
    subtitle:
      "Write normally — Cara will pick out what she must never agree to.",
    helper: "One sentence is fine.",
    progressLabel: "Services not offered",
  },
  {
    id: "hours",
    label: "Hours",
    title: "When and where do you operate?",
    subtitle:
      "Tell Cara when you're open, where you cover, and when callers should expect a response.",
    helper: "Use plain language — Cara will read this on calls.",
    progressLabel: "Hours and areas",
  },
  {
    id: "capture",
    label: "Details",
    title: "What should Cara get from each caller?",
    subtitle:
      "Pick the details Cara should note when someone wants to book or follow up.",
    helper: "Name and number are always collected.",
    progressLabel: "Caller details",
  },
  {
    id: "faqs",
    label: "Questions",
    title: "Common questions callers ask",
    subtitle: "Pick a common question or write your own.",
    helper: "Short answers work best — refine later in Cara Setup.",
    progressLabel: "Common questions",
  },
] as const;

/** Parent shell owns max-width + horizontal centering. */
export const TRAIN_CARA_CONTENT_WIDTH = "w-full";

export type TrainCaraStepId = (typeof TRAIN_CARA_STEPS)[number]["id"];

export const MIN_ABOUT_LENGTH = 15;

export const ABOUT_PLACEHOLDER =
  "Tell Cara what your business does, who you help, and what makes you different. The more detail, the more natural she'll sound on calls.";

export const OPENING_HOURS_PLACEHOLDER =
  "Mon–Fri 9am–6pm, Sat 10am–4pm, Sun closed.";

export const SERVICE_AREA_PLACEHOLDER =
  "Town and county — e.g. Galway, Co. Galway";

export const DEFAULT_DETAILS_TO_COLLECT =
  "Name, phone number, what they need, and the best time to call back.";

export const RULES_PLACEHOLDER =
  "e.g. never give prices over the phone, no walk-ins on Mondays, 48 hours notice to cancel.";

/** Always on — persisted for routing continuity, not shown in Train Cara UI. */
export const CARA_BASELINE_HANDLE_OPTIONS = [
  "answer_common_questions",
  "take_message",
] as const;

export type CaraBaselineHandleOptionId =
  (typeof CARA_BASELINE_HANDLE_OPTIONS)[number];

export const CARA_HANDLE_PICKER_OPTIONS = [
  {
    id: "send_link",
    title: "Send a link",
    description: "Share a booking page, form, or website link.",
    createsRoute: true,
  },
  {
    id: "send_file",
    title: "Send a file",
    description: "Send a brochure, menu, price list, or document.",
    createsRoute: true,
  },
  {
    id: "email_request",
    title: "Email the request",
    description: "Email caller details and the request to your team.",
    createsRoute: true,
  },
  {
    id: "send_whatsapp",
    title: "Send on WhatsApp",
    description: "Follow up with the caller on WhatsApp.",
    createsRoute: true,
  },
  {
    id: "capture_quote_requests",
    title: "Capture quote requests",
    description: "Collect quote details, location, and urgency.",
    createsRoute: true,
  },
  {
    id: "book_meeting",
    title: "Book a meeting",
    description: "Send a link to book a meeting or call.",
    createsRoute: true,
  },
] as const;

export type CaraHandlePickerOptionId =
  (typeof CARA_HANDLE_PICKER_OPTIONS)[number]["id"];

export type CaraHandleOptionId =
  | CaraBaselineHandleOptionId
  | CaraHandlePickerOptionId;

const BASELINE_OPTION_META: Record<
  CaraBaselineHandleOptionId,
  { title: string; description: string; createsRoute: boolean }
> = {
  answer_common_questions: {
    title: "Answer common questions",
    description: "Hours, location, pricing basics, and other FAQs.",
    createsRoute: false,
  },
  take_message: {
    title: "Take a message",
    description: "Capture details and add them to the Action Inbox.",
    createsRoute: false,
  },
};

export const CARA_HANDLE_OPTIONS = [
  ...CARA_BASELINE_HANDLE_OPTIONS.map((id) => ({
    id,
    ...BASELINE_OPTION_META[id],
  })),
  ...CARA_HANDLE_PICKER_OPTIONS,
] as const;

export const HANDLE_OPTION_BY_ID = new Map(
  CARA_HANDLE_OPTIONS.map((option) => [option.id, option]),
);

export function ensureRequiredHandleOptions(
  options: CaraHandleOptionId[],
): CaraHandleOptionId[] {
  const selected = new Set<CaraHandleOptionId>(options);
  for (const id of CARA_BASELINE_HANDLE_OPTIONS) {
    selected.add(id);
  }
  const order: CaraHandleOptionId[] = [
    ...CARA_BASELINE_HANDLE_OPTIONS,
    ...CARA_HANDLE_PICKER_OPTIONS.map((option) => option.id),
  ];
  return order.filter((id) => selected.has(id));
}

/** Used by onboarding UI copy generation — universal fallbacks only. */
export const FAQ_EXAMPLE_SUGGESTION_COUNT = 3;
export const BUSINESS_RULE_SUGGESTION_COUNT = 5;

export const DEFAULT_FAQ_SUGGESTIONS = [
  "How much does it cost?",
  "How do I book or get started?",
  "What should I expect on a first visit?",
] as const;

export const DEFAULT_BUSINESS_RULE_SUGGESTIONS = [
  "We need 24 hours' notice to cancel or reschedule.",
  "We don't give prices over the phone.",
  "We're closed on bank holidays.",
  "Always take a message if no one's available.",
  "Flag anything urgent straight away.",
] as const;

export const TRADES_FAQ_SUGGESTIONS = [
  "Do you offer emergency callouts?",
  "What areas do you cover?",
  "How much does a callout cost?",
] as const;

export const SALON_FAQ_SUGGESTIONS = [
  "Do you take walk-ins?",
  "How much is a cut and colour?",
  "How far ahead should I book?",
] as const;

