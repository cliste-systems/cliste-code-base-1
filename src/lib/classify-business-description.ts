import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import {
  isOrganizationNiche,
  parseOrganizationNiche,
  type OrganizationNiche,
} from "@/lib/organization-niche";

export type ClassifiedBusiness = {
  agentBusinessType: string;
  niche: OrganizationNiche;
  /** True for medical/health, legal, or financial businesses we don't support yet. */
  regulated: boolean;
};

const MAX_DESCRIPTION = 200;

function trimDescription(text: string): string {
  return text.trim().slice(0, MAX_DESCRIPTION);
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Medical/health, legal, or financial — out of scope until extra compliance is built. */
export function isRegulatedBusinessText(text: string): boolean {
  const lower = text.toLowerCase();
  const medical =
    /\b(doctor|gp|medical|clinic|hospital|dentist|dental|orthodont|physiotherap|chiropract|osteopath|podiatr|optician|optometr|pharmac|chemist|vet|veterinar|nurse|nursing|care home|home care|hospice|psychotherap|psycholog|psychiatr|mental health|botox|dermatolog|aesthetic clinic)\b/i;
  const legal =
    /\b(solicitor|barrister|law firm|legal advice|attorney|conveyancing)\b/i;
  const financial =
    /\b(insurance|mortgage broker|financial advisor|financial adviser|investment advice|stockbroker|pension advice)\b/i;
  return medical.test(lower) || legal.test(lower) || financial.test(lower);
}

function heuristicNiche(lower: string): OrganizationNiche {
  if (/\b(barber|barbershop|barber shop|barbers)\b/i.test(lower)) {
    return "barber";
  }
  if (
    /\b(hairdresser|hairdressers|hair salon|hair stylist|hairstylist|hair and beauty)\b/i.test(
      lower,
    ) ||
    (/\bsalon\b/i.test(lower) && !/\b(tanning|sun|nail|beauty)\b/i.test(lower))
  ) {
    return "hair_salon";
  }
  if (
    /\b(nail|nails|beauty salon|beautician|spa|lash|brow|wax|tanning|aesthetic|makeup|make-up|skincare|facial)\b/i.test(
      lower,
    )
  ) {
    return "beauty";
  }
  if (
    /\b(plumb|electric|heating|boiler|hvac|carpenter|carpentry|joiner|builder|construction|roofer|roofing|plaster|tiler|tiling|painter|painting|decorator|handyman|kitchen fitter|bathroom fitter|landscap|fencing|groundwork|scaffold|welder|glazier|drainage)\b/i.test(
      lower,
    )
  ) {
    return "trades";
  }
  if (
    /\b(cleaning|cleaner|window clean|gardening|gardener|pest control|locksmith|removal|man with a van|chimney|gutter|driveway|pressure wash|waste|skip hire)\b/i.test(
      lower,
    )
  ) {
    return "home_services";
  }
  if (
    /\b(restaurant|cafe|caf\u00e9|coffee|takeaway|take away|deli|pub|bar|bistro|catering|caterer|food truck|bakery|patisserie|chipper|pizzeria|hotel|guesthouse|b&b)\b/i.test(
      lower,
    )
  ) {
    return "hospitality";
  }
  if (
    /\b(online shop|online store|ecommerce|e-commerce|web shop|webshop|dropship|online boutique|online retailer)\b/i.test(
      lower,
    )
  ) {
    return "ecommerce";
  }
  if (
    /\b(shop|store|boutique|retail|florist|butcher|grocer|greengrocer|off licence|off-licence|newsagent|hardware|pharmacy shop|gift shop|jeweller|bookshop)\b/i.test(
      lower,
    )
  ) {
    return "retail";
  }
  if (
    /\b(gym|fitness|yoga|pilates|personal train|crossfit|martial art|boxing|wellness|nutrition|sports club|swim school|dance studio)\b/i.test(
      lower,
    )
  ) {
    return "fitness";
  }
  if (
    /\b(garage|mechanic|car repair|tyre|tyres|auto|automotive|valeting|valet|body shop|bodyshop|car wash|car sales|motor)\b/i.test(
      lower,
    )
  ) {
    return "automotive";
  }
  if (
    /\b(wedding|event|events|photographer|photography|videographer|dj|disco|venue|entertain|party|marquee|florist hire)\b/i.test(
      lower,
    )
  ) {
    return "events";
  }
  if (
    /\b(tutor|tuition|school|academy|driving instructor|driving school|training|lessons|grind|montessori|creche|cr\u00e8che|childcare|education)\b/i.test(
      lower,
    )
  ) {
    return "education";
  }
  if (
    /\b(solicitor|accountant|accounting|bookkeep|consultant|consulting|agency|architect|surveyor|estate agent|letting agent|marketing|recruitment|insurance|mortgage|financial|engineer|it support|software|translation)\b/i.test(
      lower,
    )
  ) {
    return "professional_services";
  }
  return "other";
}

function labelForNiche(niche: OrganizationNiche, fallback: string): string {
  const labels: Record<OrganizationNiche, string> = {
    hair_salon: "Hair salon",
    barber: "Barber",
    beauty: "Beauty salon",
    trades: "Trades business",
    home_services: "Home services",
    hospitality: "Hospitality",
    retail: "Retail shop",
    ecommerce: "Online shop",
    professional_services: "Professional services",
    fitness: "Fitness studio",
    automotive: "Automotive",
    events: "Events",
    education: "Training provider",
    other: fallback,
  };
  return labels[niche];
}

/** Offline classification from plain-English business description. */
export function classifyBusinessDescriptionHeuristic(
  description: string,
): ClassifiedBusiness {
  const text = trimDescription(description);
  const lower = text.toLowerCase();

  if (!text) {
    return {
      agentBusinessType: "Local business",
      niche: "other",
      regulated: false,
    };
  }

  const regulated = isRegulatedBusinessText(lower);
  const niche = heuristicNiche(lower);

  const firstChunk = text.split(/[,.\n]/)[0]?.trim() || text;
  const words = firstChunk.split(/\s+/).filter(Boolean);
  const shortLabel =
    words.length <= 4
      ? titleCaseWords(firstChunk)
      : titleCaseWords(words.slice(0, 3).join(" "));

  return {
    agentBusinessType:
      niche === "other" ? shortLabel : labelForNiche(niche, shortLabel),
    niche,
    regulated,
  };
}

const SUPPORTED_NICHE_LIST =
  "hair_salon, barber, beauty, trades, home_services, hospitality, retail, ecommerce, professional_services, fitness, automotive, events, education, other";

/** Classify plain-English description; uses AI when configured, else heuristics. */
export async function classifyBusinessDescription(
  description: string,
): Promise<ClassifiedBusiness> {
  const text = trimDescription(description);
  if (!text) {
    return classifyBusinessDescriptionHeuristic("");
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.1,
      maxTokens: 140,
      messages: [
        {
          role: "system",
          content: `You classify Irish/local businesses from the owner's plain-English description.
Return JSON only: {"agentBusinessType":"short label","niche":"<one of the list>","regulated":true|false}
Rules:
- niche must be exactly one of: ${SUPPORTED_NICHE_LIST}.
- Pick the closest fit; use "other" only when nothing fits.
- "regulated" is true ONLY for medical/health, legal, or financial-advice businesses (doctor, dentist, physio, vet, pharmacy, care home, solicitor, barrister, insurance, mortgage/financial advisor). Otherwise false.
- agentBusinessType: 1-4 words describing the business (e.g. "Hair salon", "Plumber", "Coffee shop", "Estate agent").`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const json = JSON.parse(raw) as {
      agentBusinessType?: unknown;
      niche?: unknown;
      regulated?: unknown;
    };
    const agentBusinessType = String(json.agentBusinessType ?? "")
      .trim()
      .slice(0, 80);
    const nicheRaw = String(json.niche ?? "").trim();
    const niche: OrganizationNiche = isOrganizationNiche(nicheRaw)
      ? nicheRaw
      : parseOrganizationNiche(nicheRaw);
    // Trust AI, but never let a clearly-regulated description slip through as false.
    const regulated =
      json.regulated === true || isRegulatedBusinessText(text);

    if (agentBusinessType.length >= 2) {
      return { agentBusinessType, niche, regulated };
    }
  } catch {
    // fall through to heuristics
  }

  return classifyBusinessDescriptionHeuristic(text);
}
