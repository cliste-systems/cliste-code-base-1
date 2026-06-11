import { routeActionType, type SavedRoute } from "./route-models";
import type { RouteActionType } from "./route-templates";

export type RouteCategory = {
  id: string;
  label: string;
  actionTypes: RouteActionType[];
};

export const ROUTE_CATEGORIES: RouteCategory[] = [
  { id: "link", label: "Send link", actionTypes: ["send_link", "directions"] },
  { id: "file", label: "Send file", actionTypes: ["send_file"] },
  { id: "message", label: "Take message", actionTypes: ["take_message"] },
  { id: "transfer", label: "Transfer", actionTypes: ["transfer"] },
  { id: "other", label: "Other", actionTypes: ["email", "whatsapp"] },
];

export function groupCustomRoutesByCategory(routes: SavedRoute[]) {
  const buckets = new Map<string, SavedRoute[]>(
    ROUTE_CATEGORIES.map((c) => [c.id, []]),
  );

  for (const route of routes) {
    const type = routeActionType(route);
    const category =
      ROUTE_CATEGORIES.find((c) => c.actionTypes.includes(type)) ??
      ROUTE_CATEGORIES.find((c) => c.id === "other")!;
    buckets.get(category.id)!.push(route);
  }

  return ROUTE_CATEGORIES.map((category) => ({
    ...category,
    routes: buckets.get(category.id) ?? [],
  })).filter((group) => group.routes.length > 0);
}
