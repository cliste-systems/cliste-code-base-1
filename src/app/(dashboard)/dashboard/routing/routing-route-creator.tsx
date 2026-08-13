"use client";

import {
  ArrowRight,
  FileText,
  LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  PhoneForwarded,
  Plus,
  Route,
} from "lucide-react";

import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ROUTE_ACTION_TYPES,
  type RouteActionType,
  type RouteActionTypeMeta,
} from "./route-templates";

type Props = {
  onCreateClick: (actionType?: RouteActionType) => void;
};

const ACTION_ICONS: Record<RouteActionType, typeof LinkIcon> = {
  send_link: LinkIcon,
  send_file: FileText,
  directions: MapPin,
  take_message: MessageSquare,
  email: Mail,
  whatsapp: MessageSquare,
  transfer: PhoneForwarded,
};

export function RoutingRouteCreator({ onCreateClick }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#dfe7e2] bg-[#fbfcfb] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#11181d]">Create a route</h2>
        <p className="mt-0.5 text-[12px] text-[#6b7c75]">
          When a caller wants something specific, Cara runs your route.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
        <div className="rounded-lg border border-[#d9e2dd] bg-white p-4 shadow-[0_1px_0_rgba(17,24,29,0.04)]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#cfd9d4] bg-[#fbfcfb] text-[#353D42]">
              <Route className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#11181d]">
                Pick what Cara should do
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#6b7c75]">
                Choose the action first, then add the caller phrases and destination in the editor.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {ROUTE_ACTION_TYPES.map((action) => (
            <RouteActionButton
              key={action.id}
              action={action}
              onClick={() => onCreateClick(action.id)}
            />
          ))}
        </div>

        <Button
          type="button"
          onClick={() => onCreateClick()}
          className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "mt-4 w-full justify-center")}
        >
          <Plus className="size-4" aria-hidden />
          Create blank route
        </Button>
      </div>
    </div>
  );
}

function RouteActionButton({
  action,
  onClick,
}: {
  action: RouteActionTypeMeta;
  onClick: () => void;
}) {
  const Icon = ACTION_ICONS[action.id] ?? Route;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-lg border border-[#d9e2dd] bg-white px-3 py-3 text-left shadow-[0_1px_0_rgba(17,24,29,0.04)] transition-colors hover:border-[#9da9a4]"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-[#d9e2dd] bg-[#fbfcfb] text-[#353D42]">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[#11181d]">
          {action.label}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[#6b7c75]">
          {action.description}
        </span>
      </span>
      <ArrowRight className="mt-1 size-3.5 shrink-0 text-[#9da9a4] transition-transform group-hover:translate-x-0.5 group-hover:text-[#353D42]" aria-hidden />
    </button>
  );
}
