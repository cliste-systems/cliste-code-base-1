/**
 * Registry of every droppable knowledge section in Cara's compiled prompt.
 */

import type { KnowledgeFactType } from "@/lib/knowledge-precedence";
import { PROTECTED_PRECEDENCE_PART_ID } from "@/lib/knowledge-precedence";

export type KnowledgeSurfaceDef = {
  id: string;
  factTypes: KnowledgeFactType[];
  /** Lower = higher authority in Cara's reading order. */
  precedenceRank: number;
  /** Higher = dropped first when the prompt exceeds budget. */
  dropPriority: number;
};

export { PROTECTED_PRECEDENCE_PART_ID };

export const CARA_KNOWLEDGE_SURFACES: readonly KnowledgeSurfaceDef[] = [
  {
    id: "businessRules",
    factTypes: ["policies"],
    precedenceRank: 20,
    dropPriority: 50,
  },
  {
    id: "caraConduct",
    factTypes: ["conduct", "policies"],
    precedenceRank: 25,
    dropPriority: 40,
  },
  {
    id: "greeting",
    factTypes: ["identity"],
    precedenceRank: 30,
    dropPriority: 30,
  },
  {
    id: "location",
    factTypes: ["hours", "serviceArea"],
    precedenceRank: 40,
    dropPriority: 20,
  },
  {
    id: "catalog",
    factTypes: ["services", "prices"],
    precedenceRank: 50,
    dropPriority: 60,
  },
  {
    id: "supplement",
    factTypes: ["services", "prices"],
    precedenceRank: 60,
    dropPriority: 70,
  },
  {
    id: "faqs",
    factTypes: ["faqs", "policies"],
    precedenceRank: 70,
    dropPriority: 10,
  },
  {
    id: "files",
    factTypes: ["services", "prices", "faqs"],
    precedenceRank: 80,
    dropPriority: 90,
  },
  {
    id: "anythingElse",
    factTypes: ["services", "hours", "serviceArea", "faqs"],
    precedenceRank: 90,
    dropPriority: 100,
  },
] as const;

export const CARA_KNOWLEDGE_SURFACE_IDS = CARA_KNOWLEDGE_SURFACES.map(
  (s) => s.id,
);

/** Assembly order — lower precedenceRank first. */
export const CARA_KNOWLEDGE_ASSEMBLY_ORDER = [...CARA_KNOWLEDGE_SURFACES]
  .sort((a, b) => a.precedenceRank - b.precedenceRank)
  .map((s) => s.id);

/** Whole-section drop order — higher dropPriority first. */
export const CARA_KNOWLEDGE_DROP_ORDER = [...CARA_KNOWLEDGE_SURFACES]
  .sort((a, b) => b.dropPriority - a.dropPriority)
  .map((s) => s.id);

export const KNOWLEDGE_SURFACE_REGISTRY_ERROR =
  "Every Cara knowledge source must be registered in knowledge-surfaces.ts with an explicit precedence rank. Add the new surface and its precedence before shipping.";

export function validateKnowledgeSurfaceRegistry(): void {
  const ranks = new Set<number>();
  const dropPriorities = new Set<number>();
  for (const surface of CARA_KNOWLEDGE_SURFACES) {
    if (ranks.has(surface.precedenceRank)) {
      throw new Error(
        `${KNOWLEDGE_SURFACE_REGISTRY_ERROR} Duplicate precedenceRank ${surface.precedenceRank}.`,
      );
    }
    ranks.add(surface.precedenceRank);
    if (dropPriorities.has(surface.dropPriority)) {
      throw new Error(
        `${KNOWLEDGE_SURFACE_REGISTRY_ERROR} Duplicate dropPriority ${surface.dropPriority}.`,
      );
    }
    dropPriorities.add(surface.dropPriority);
  }
}

export function assertRegisteredKnowledgeSectionIds(ids: string[]): void {
  const registered = new Set(CARA_KNOWLEDGE_SURFACE_IDS);
  for (const id of ids) {
    if (!registered.has(id)) {
      throw new Error(
        `${KNOWLEDGE_SURFACE_REGISTRY_ERROR} Unregistered section id: ${id}.`,
      );
    }
  }
}

export function sortDroppableSectionsByRegistry<
  T extends { id: string },
>(sections: T[]): T[] {
  const order = new Map(
    CARA_KNOWLEDGE_ASSEMBLY_ORDER.map((id, index) => [id, index]),
  );
  return [...sections].sort(
    (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
  );
}
