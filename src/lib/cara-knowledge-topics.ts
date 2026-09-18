export const ALL_KNOWLEDGE_GROUP_ID = "all";

export const GENERAL_KNOWLEDGE_TOPICS = [
  { id: "facilities-accessibility", label: "Facilities & accessibility" },
  { id: "hours-location", label: "Hours & location" },
  { id: "parking", label: "Parking" },
  { id: "services-payments", label: "Services & payments" },
  { id: "policies", label: "Policies" },
  { id: "contact-people", label: "Contact & people" },
] as const;

export type GeneralKnowledgeTopicId =
  (typeof GENERAL_KNOWLEDGE_TOPICS)[number]["id"];

export function generalTopicLabel(topicId: string): string | null {
  return (
    GENERAL_KNOWLEDGE_TOPICS.find((topic) => topic.id === topicId)?.label ?? null
  );
}
