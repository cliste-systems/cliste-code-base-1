import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type CaraKnowledgeSectionId =
  | "search"
  | "needs-input"
  | "knows"
  | "teach"
  | "unlearn"
  | "history";

export type CaraKnowledgeCategoryId =
  | "services"
  | "policies"
  | "prices"
  | "facts"
  | "answers"
  | "not-offered";

export const CARA_KNOWLEDGE_SECTIONS: {
  id: CaraKnowledgeSectionId;
  label: string;
  href: string;
  description: string;
}[] = [
  {
    id: "search",
    label: "Search",
    href: DASHBOARD_ROUTES.caraKnowledge,
    description: "Search anything to see whether Cara knows it",
  },
  {
    id: "needs-input",
    label: "Needs your input",
    href: DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
    description: "Things Cara couldn't answer on calls",
  },
  {
    id: "knows",
    label: "What Cara knows",
    href: DASHBOARD_ROUTES.caraKnowledgeKnows,
    description: "Everything currently active in Cara's brain",
  },
  {
    id: "teach",
    label: "Teach Cara",
    href: DASHBOARD_ROUTES.caraKnowledgeTeach,
    description: "Add something Cara should know",
  },
  {
    id: "unlearn",
    label: "Unlearn",
    href: DASHBOARD_ROUTES.caraKnowledgeUnlearn,
    description: "Remove something Cara should no longer use",
  },
  {
    id: "history",
    label: "History",
    href: DASHBOARD_ROUTES.caraKnowledgeHistory,
    description: "How Cara's knowledge has changed",
  },
];

export const CARA_KNOWLEDGE_CATEGORIES: {
  id: CaraKnowledgeCategoryId;
  label: string;
  href: string;
  description: string;
}[] = [
  {
    id: "services",
    label: "Services",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("services"),
    description: "Departments and services Cara can talk about",
  },
  {
    id: "policies",
    label: "Policies",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("policies"),
    description: "Rules and policies Cara follows on calls",
  },
  {
    id: "prices",
    label: "Prices",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("prices"),
    description: "Pricing guidance Cara can quote",
  },
  {
    id: "facts",
    label: "Business / store facts",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("facts"),
    description: "Hours, location, and store facts",
  },
  {
    id: "answers",
    label: "Answers",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("answers"),
    description: "FAQ answers Cara uses on calls",
  },
  {
    id: "not-offered",
    label: "Things you don't offer",
    href: DASHBOARD_ROUTES.caraKnowledgeKnowsCategory("not-offered"),
    description: "Services and products Cara should decline",
  },
];

export function caraKnowledgeSectionForPath(pathname: string): CaraKnowledgeSectionId {
  const path = pathname.replace(/\/$/, "") || DASHBOARD_ROUTES.caraKnowledge;
  if (path === DASHBOARD_ROUTES.caraKnowledge) return "search";
  if (path.startsWith(DASHBOARD_ROUTES.caraKnowledgeNeedsInput)) return "needs-input";
  if (path.startsWith(`${DASHBOARD_ROUTES.caraKnowledgeKnows}/`)) return "knows";
  if (path === DASHBOARD_ROUTES.caraKnowledgeKnows) return "knows";
  if (path.startsWith(DASHBOARD_ROUTES.caraKnowledgeTeach)) return "teach";
  if (path.startsWith(DASHBOARD_ROUTES.caraKnowledgeUnlearn)) return "unlearn";
  if (path.startsWith(DASHBOARD_ROUTES.caraKnowledgeHistory)) return "history";
  return "search";
}
