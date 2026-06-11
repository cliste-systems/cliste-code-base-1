"use client";

import { GripVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  groupCustomRoutesByCategory,
  type RouteCategory,
} from "./routing-routes-categories";
import {
  customRoutes,
  reorderRoutes,
  routeActionType,
  routeDestinationLabel,
  routeKeywords,
  routeNeedsSetup,
  type SavedRoute,
} from "./route-models";
import { ROUTE_ACTION_TYPE_BY_ID } from "./route-templates";
import type { RouteLintWarning } from "./routing-validation";

type Props = {
  routes: SavedRoute[];
  selectedId: string | null;
  warningsByRoute: Map<string, RouteLintWarning[]>;
  draggingId: string | null;
  onSelect: (route: SavedRoute) => void;
  onDelete: (route: SavedRoute) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
};

export function RoutingRoutesList({
  routes,
  selectedId,
  warningsByRoute,
  draggingId,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: Props) {
  const custom = customRoutes(routes);
  const groups = groupCustomRoutesByCategory(custom);
  const priorityById = new Map(custom.map((r, i) => [r.id, i + 1]));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#0b1220]">Your routes</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {custom.length === 0
            ? "Saved routes appear here by type."
            : `${custom.length} route${custom.length === 1 ? "" : "s"} · top wins when two match`}
        </p>
      </div>

      {custom.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <p
            role="status"
            className="rounded-xl border border-slate-200/90 bg-slate-50 px-5 py-2.5 text-center text-[13px] font-medium text-slate-500"
          >
            No routes yet — create one on the left.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          <div className="space-y-5">
            {groups.map((group) => (
              <CategoryGroup
                key={group.id}
                group={group}
                priorityById={priorityById}
                selectedId={selectedId}
                warningsByRoute={warningsByRoute}
                draggingId={draggingId}
                onSelect={onSelect}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryGroup({
  group,
  priorityById,
  selectedId,
  warningsByRoute,
  draggingId,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  group: RouteCategory & { routes: SavedRoute[] };
  priorityById: Map<string, number>;
  selectedId: string | null;
  warningsByRoute: Map<string, RouteLintWarning[]>;
  draggingId: string | null;
  onSelect: (route: SavedRoute) => void;
  onDelete: (route: SavedRoute) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {group.label}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {group.routes.map((route) => (
          <RouteRow
            key={route.id}
            route={route}
            priority={priorityById.get(route.id)}
            selected={selectedId === route.id}
            warnings={warningsByRoute.get(route.id) ?? []}
            isDragging={draggingId === route.id}
            onSelect={() => onSelect(route)}
            onDelete={() => onDelete(route)}
            onDragStart={() => onDragStart(route.id)}
            onDragEnd={onDragEnd}
            onDrop={() => onDrop(route.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function RouteRow({
  route,
  priority,
  selected,
  warnings,
  isDragging,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  route: SavedRoute;
  priority?: number;
  selected: boolean;
  warnings: RouteLintWarning[];
  isDragging: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const needs = routeNeedsSetup(route);
  const verb = ROUTE_ACTION_TYPE_BY_ID.get(routeActionType(route))?.verb ?? "handles it";
  const destination = routeDestinationLabel(route);

  return (
    <li
      className={cn(
        "rounded-lg border transition-colors",
        selected
          ? "border-[#0b1220]/20 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300",
        isDragging && "opacity-50",
        needs && "border-amber-200/90",
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className="mt-0.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          aria-label={`Drag ${route.name}`}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {typeof priority === "number" ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                #{priority}
              </span>
            ) : null}
            <span className="text-[13px] font-semibold text-[#0b1220]">
              {route.name.trim() || "Untitled"}
            </span>
            {needs ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-800">
                Setup
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {verb} · {destination}
          </p>
          {routeKeywords(route) ? (
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              &ldquo;{routeKeywords(route)}&rdquo;
            </p>
          ) : null}
          {warnings[0] ? (
            <p className="mt-1 text-[10px] text-amber-900">{warnings[0].message}</p>
          ) : null}
        </button>
        <div className="flex shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md"
            onClick={onSelect}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}
