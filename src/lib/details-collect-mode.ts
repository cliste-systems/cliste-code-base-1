import { COLLECTION_RELEVANCE_INSTRUCTION } from "@/lib/call-handling-boundary";

export type DetailsCollectMode = "conversational" | "fixed";

export function parseDetailsCollectMode(raw: unknown): DetailsCollectMode {
  return raw === "fixed" ? "fixed" : "conversational";
}

function formatListPhrase(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const FIXED_ORDER_INSTRUCTION =
  "I always get their name and number first. When it's relevant to the call, I work through the optional details below in this order — one at a time, woven into the chat naturally. I don't skip ahead unless the caller has already given something. If they don't want to share something, I keep helping, note what's missing, and move on.";

export function buildDetailsCollectionPromptSection(
  collectItems: string[],
  mode: DetailsCollectMode,
): string {
  if (mode === "fixed" && collectItems.length > 0) {
    const numbered = collectItems.map((item, index) => `${index + 1}. ${item}`);
    return `${FIXED_ORDER_INSTRUCTION}\n\nOptional details, in order:\n${numbered.join("\n")}`;
  }

  const parts = [COLLECTION_RELEVANCE_INSTRUCTION];
  if (collectItems.length > 0) {
    parts.push(
      `When it's relevant, I also try to get: ${formatListPhrase(collectItems)}.`,
    );
  }
  return parts.join("\n\n");
}

export function moveDetailsCollectItem(
  items: string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
