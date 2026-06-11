import {
  parseOrganizationNiche,
  type OrganizationNiche,
} from "@/lib/organization-niche";

/**
 * A "vertical" is the customer-facing grouping we tailor the whole product to.
 *
 * It sits one level above {@link OrganizationNiche}: a single vertical can cover
 * several niches (e.g. the "Salon & Beauty" vertical covers hair salons,
 * barbers, nail/beauty studios, spas, lashes, brows…). We tailor onboarding and
 * dashboard copy per vertical so we can polish one vertical end-to-end before
 * adding the next, instead of half-tailoring all 14 niches at once.
 *
 * `generic` is the deliberate fallback: anything we haven't tailored yet uses
 * neutral, business-agnostic copy.
 */
export type VerticalId = "salon_beauty" | "generic";

export type VerticalSelectionChoice = {
  id: VerticalId;
  /** Headline on the onboarding picker card. */
  label: string;
  /** One-liner under the headline. */
  description: string;
  /** Example businesses that belong here (chips on the picker). */
  examples: string[];
};

export type VerticalPack = {
  id: VerticalId;
  /** Niche stored when this vertical is explicitly chosen and the description
   * doesn't classify to a more specific niche inside the vertical. */
  defaultNiche: OrganizationNiche;
  /** Niches that belong to this vertical. Empty = catch-all (generic). */
  niches: readonly OrganizationNiche[];
  selection: Omit<VerticalSelectionChoice, "id">;
  /** Short noun shown beside "Cliste" in the dashboard header / product chrome. */
  productNoun: string;
  /** How Cara/the product refers to a customer's clientele (e.g. "clients"). */
  customerNoun: { singular: string; plural: string };
};

/** Niches that roll up into the Salon & Beauty vertical. */
const SALON_BEAUTY_NICHES = ["hair_salon", "barber", "beauty"] as const;

const SALON_BEAUTY_PACK: VerticalPack = {
  id: "salon_beauty",
  defaultNiche: "hair_salon",
  niches: SALON_BEAUTY_NICHES,
  selection: {
    label: "Salon & Beauty",
    description:
      "Appointment-based beauty businesses — Cara is tuned for bookings, services and stylists.",
    examples: ["Hair salon", "Barber", "Nail bar", "Beauty salon", "Spa", "Lashes & brows"],
  },
  productNoun: "Salon",
  customerNoun: { singular: "client", plural: "clients" },
};

const GENERIC_PACK: VerticalPack = {
  id: "generic",
  defaultNiche: "other",
  niches: [],
  selection: {
    label: "Something else",
    description:
      "Any other local business. Cara still answers calls, takes messages and shares your links.",
    examples: ["Trades", "Hospitality", "Retail", "Professional services"],
  },
  productNoun: "Business",
  customerNoun: { singular: "caller", plural: "callers" },
};

export const VERTICAL_PACKS: Record<VerticalId, VerticalPack> = {
  salon_beauty: SALON_BEAUTY_PACK,
  generic: GENERIC_PACK,
};

/**
 * Choices shown on the onboarding niche picker, in display order. Today this is
 * intentionally short: the tailored vertical plus the generic fallback. Add a
 * new pack here (e.g. trades) when its copy is ready.
 */
export const VERTICAL_CHOICES: VerticalSelectionChoice[] = [
  { id: SALON_BEAUTY_PACK.id, ...SALON_BEAUTY_PACK.selection },
  { id: GENERIC_PACK.id, ...GENERIC_PACK.selection },
];

const NICHE_TO_VERTICAL: ReadonlyMap<OrganizationNiche, VerticalId> = new Map(
  SALON_BEAUTY_NICHES.map((niche) => [niche, "salon_beauty" as VerticalId]),
);

/** Which vertical a stored niche belongs to. */
export function verticalIdForNiche(
  raw: string | null | undefined,
): VerticalId {
  return NICHE_TO_VERTICAL.get(parseOrganizationNiche(raw)) ?? "generic";
}

/** The tailored pack for a stored niche (falls back to the generic pack). */
export function verticalPackForNiche(
  raw: string | null | undefined,
): VerticalPack {
  return VERTICAL_PACKS[verticalIdForNiche(raw)];
}

export function isVerticalId(v: string): v is VerticalId {
  return v === "salon_beauty" || v === "generic";
}

export function parseVerticalId(
  raw: string | null | undefined,
): VerticalId | null {
  return raw && isVerticalId(raw) ? raw : null;
}

/**
 * Resolve the niche to store given the owner's explicit vertical choice and the
 * niche our classifier inferred from their description.
 *
 * - "Salon & Beauty" chosen: keep the classified niche when it's inside the
 *   salon family (so barber vs hair salon vs beauty stays accurate), otherwise
 *   pin it to the vertical's default so they still get the tailored experience.
 * - "Something else" (or no choice): trust the classifier as before.
 */
export function resolveNicheForVerticalChoice(
  choice: VerticalId | null,
  classifiedNiche: OrganizationNiche,
): OrganizationNiche {
  if (choice === "salon_beauty") {
    return verticalIdForNiche(classifiedNiche) === "salon_beauty"
      ? classifiedNiche
      : SALON_BEAUTY_PACK.defaultNiche;
  }
  return classifiedNiche;
}
