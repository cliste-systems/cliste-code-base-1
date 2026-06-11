import "server-only";

import {
  ROUTE_ACTION_TYPE_BY_ID,
  type RouteActionType,
  type RouteNameSuggestion,
} from "@/app/(dashboard)/dashboard/routing/route-templates";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

export type RouteNamingContext = {
  businessName: string;
  businessType: string;
  niche: string;
};

export type RouteNamingRequest = {
  actionType: RouteActionType;
  url?: string;
  fileName?: string;
  currentName?: string;
  existingNames?: string[];
};

const MAX_NAME_LEN = 48;
const MAX_LABEL_LEN = 48;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

/**
 * Ask the model for a short, caller-facing name for one routing action so Cara
 * can match what the caller asks for. Returns null on any failure (the caller
 * treats naming as optional, never blocking).
 */
export async function suggestRouteNaming(
  context: RouteNamingContext,
  request: RouteNamingRequest,
): Promise<RouteNameSuggestion | null> {
  const meta = ROUTE_ACTION_TYPE_BY_ID.get(request.actionType);
  if (!meta) return null;

  const wantsLabel = meta.outcome === "send_link";
  const business =
    [context.businessName, context.businessType, context.niche]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" · ") || "an Irish small business";

  const sourceLines = [
    `Action: Cara ${meta.verb} (${meta.label}).`,
    request.url ? `Link/URL: ${request.url}` : "",
    request.fileName ? `File name: ${request.fileName}` : "",
    request.currentName ? `Current draft name: ${request.currentName}` : "",
    request.existingNames && request.existingNames.length > 0
      ? `Already used (must differ): ${request.existingNames.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.3,
      maxTokens: 120,
      messages: [
        {
          role: "system",
          content: `You name one call-routing action for "Cara", an Irish business's AI phone receptionist. The name is what Cara matches when a caller asks for something, so it must describe the THING THE CALLER WANTS in their words — not the mechanism.

Return JSON only:
{
  "name": "2-4 word caller-facing name, Title case (e.g. 'Book an appointment', 'Lunch menu', 'Gents' price list', 'Directions')",
  "label": "${wantsLabel ? "for a single link, a short label for what the caller might say; else empty" : "empty string"}"
}

Rules:
- Be specific. If a file/link clearly indicates a niche (e.g. 'gents_price_list.pdf'), reflect it ('Gents' price list').
- Must be DISTINCT from any names already used.
- No quotes, no emojis, no trailing punctuation. Keep under 6 words.`,
        },
        {
          role: "user",
          content: `Business: ${business}

${wrapUserContentForPrompt("action", sourceLines)}`,
        },
      ],
    });

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

    const name = clean(parsed.name, MAX_NAME_LEN);
    if (!name) return null;
    const label = wantsLabel ? clean(parsed.label, MAX_LABEL_LEN) : "";
    return label ? { name, label } : { name };
  } catch (err) {
    console.warn("[route-naming-suggest] failed", err);
    return null;
  }
}
