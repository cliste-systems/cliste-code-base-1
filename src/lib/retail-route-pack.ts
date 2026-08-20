import type { RoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-links";

function link(id: string, intent: string, targetType: RoutingLink["targetType"], url: string, extra: Partial<RoutingLink> = {}): RoutingLink {
  return {
    id,
    label: intent.charAt(0).toUpperCase() + intent.slice(1),
    intent: intent.toLowerCase(),
    targetType,
    url,
    active: true,
    ...extra,
  };
}

/** Static retail routes seeded on store creation (non-department). */
export function buildRetailRoutePack(input: {
  mapsUrl?: string;
  clickCollectUrl?: string;
  careersUrl?: string;
}): RoutingLink[] {
  const maps = input.mapsUrl?.trim() || "https://maps.google.com";
  const clickCollect = input.clickCollectUrl?.trim() || "";
  const careers = input.careersUrl?.trim() || "";

  const routes: RoutingLink[] = [
    link(
      "retail-hours",
      "opening hours, are you open",
      "callback",
      "Name, phone number, and what they need — we will confirm hours on callback if unsure.",
      { presetId: "hours-enquiry", keywords: "hours, open, closed, opening times" },
    ),
    link(
      "retail-directions",
      "where are you, directions, location",
      "link",
      maps,
      {
        presetId: "location",
        keywords: "where, directions, location, address, find you, map",
        description: "Say the address first, then offer to text the maps link.",
      },
    ),
    link(
      "retail-stock",
      "is this in stock, do you have",
      "callback",
      "Name, phone number, item they are looking for, and department if known. Never confirm stock on the call.",
      { presetId: "stock-enquiry", keywords: "in stock, have you got, do you sell, availability" },
    ),
    link(
      "retail-complaint",
      "complaint, unhappy, refund",
      "callback",
      "Name, phone number, and full details of the complaint.",
      { presetId: "complaint", keywords: "complaint, unhappy, refund, disappointed" },
    ),
    link(
      "retail-lost-property",
      "lost property, left something",
      "callback",
      "Name, phone number, description of item, and when they visited.",
      { presetId: "lost-property", keywords: "lost, left behind, forgotten" },
    ),
    link(
      "retail-supplier",
      "supplier, rep, delivery driver",
      "callback",
      "Company name, contact name, phone number, and reason for calling.",
      { presetId: "supplier", keywords: "supplier, rep, delivery, wholesaler" },
    ),
    link(
      "retail-recruitment",
      "job, recruitment, hiring",
      "callback",
      careers
        ? `Take name, phone, and role interest. Offer careers link: ${careers}`
        : "Name, phone number, role interest, and availability.",
      { presetId: "recruitment", keywords: "job, jobs, hiring, recruitment, work" },
    ),
    link(
      "retail-delivery",
      "delivery, deliver to",
      "callback",
      "Name, phone number, address area, and what they need. Do not promise a slot.",
      { presetId: "delivery", keywords: "delivery, deliver, home delivery" },
    ),
  ];

  if (clickCollect) {
    routes.push(
      link(
        "retail-click-collect",
        "click and collect, online order",
        "link",
        clickCollect,
        { presetId: "click-collect", keywords: "click and collect, online order, web order" },
      ),
    );
  }

  routes.push(
    link(
      "retail-fallback",
      "anything else",
      "callback",
      "Name, phone number, and what they need.",
      { presetId: "general", active: true },
    ),
  );

  return routes;
}
