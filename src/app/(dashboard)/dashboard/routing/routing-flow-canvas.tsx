"use client";

import { useMemo, useState } from "react";

import { DetailPanelShell } from "@/components/dashboard/list-detail";
import { cn } from "@/lib/utils";

import { AddRouteDialog } from "./add-route-dialog";
import { buildRouteForActionType } from "./routing-cara-context";
import { useRoutingForm } from "./routing-form-context";
import { RoutingRouteCreator } from "./routing-route-creator";
import { RoutingRoutesList } from "./routing-routes-list";
import {
  isCustomRoute,
  reorderRoutes,
  type SavedRoute,
} from "./route-models";
import { buildAllRouteLintWarnings } from "./routing-validation";

function otherActiveNames(routes: SavedRoute[], exceptId: string): string[] {
  return routes
    .filter((r) => r.id !== exceptId && r.active)
    .map((r) => r.name.trim())
    .filter(Boolean);
}

export function RoutingFlowCanvas() {
  const form = useRoutingForm();
  const { routes, setRoutes, sendableFiles, caraContext, setupContext } = form;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<SavedRoute | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const lintWarnings = useMemo(
    () => buildAllRouteLintWarnings(routes, setupContext),
    [routes, setupContext],
  );
  const warningsByRoute = useMemo(() => {
    const map = new Map<string, (typeof lintWarnings)[number][]>();
    for (const w of lintWarnings) {
      const list = map.get(w.routeId) ?? [];
      list.push(w);
      map.set(w.routeId, list);
    }
    return map;
  }, [lintWarnings]);

  const startNewRoute = () => {
    const route = buildRouteForActionType("send_link", caraContext, { name: "" });
    setDraft({ ...route, name: "", keywords: "", description: "", note: "" });
    setEditingId(route.id);
    setIsNewDraft(true);
    setDialogOpen(true);
  };

  const startEditRoute = (route: SavedRoute) => {
    setDraft({ ...route });
    setEditingId(route.id);
    setIsNewDraft(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDraft(null);
    setEditingId(null);
    setIsNewDraft(false);
  };

  const saveDraft = () => {
    if (!draft) return;
    const saved: SavedRoute = {
      ...draft,
      kind: "custom",
      url: draft.outcome === "send_link" ? draft.url.trim() : draft.url,
    };
    const exists = routes.some((r) => r.id === saved.id);
    const next = exists
      ? routes.map((r) => (r.id === saved.id ? saved : r))
      : [...routes, saved];
    setRoutes(next);
    closeDialog();
  };

  const deleteRoute = (route: SavedRoute) => {
    if (!isCustomRoute(route)) return;
    setRoutes(routes.filter((r) => r.id !== route.id));
    if (editingId === route.id) closeDialog();
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setRoutes(reorderRoutes(routes, draggingId, targetId));
    setDraggingId(null);
  };

  return (
    <>
      <div
        className={cn(
          "grid min-h-[min(520px,60vh)] flex-1 grid-cols-1 overflow-hidden",
          "lg:grid-cols-2 lg:divide-x lg:divide-slate-100",
        )}
      >
        <DetailPanelShell surface="embedded">
          <RoutingRouteCreator onCreateClick={startNewRoute} />
        </DetailPanelShell>

        <DetailPanelShell surface="embedded">
          <RoutingRoutesList
            routes={routes}
            selectedId={editingId}
            warningsByRoute={warningsByRoute}
            draggingId={draggingId}
            onSelect={startEditRoute}
            onDelete={deleteRoute}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
          />
        </DetailPanelShell>
      </div>

      <AddRouteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
        route={draft}
        isNew={isNewDraft}
        sendableFiles={sendableFiles}
        caraContext={caraContext}
        setupContext={setupContext}
        otherNames={draft ? otherActiveNames(routes, draft.id) : []}
        lintWarnings={draft ? warningsByRoute.get(draft.id) ?? [] : []}
        onChange={setDraft}
        onSave={saveDraft}
      />
    </>
  );
}
