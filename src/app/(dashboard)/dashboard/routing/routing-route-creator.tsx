"use client";

import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";

type Props = {
  onCreateClick: () => void;
};

export function RoutingRouteCreator({ onCreateClick }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#0b1220]">Create a route</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          When a caller wants something specific, Cara runs your route.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <Button
          type="button"
          onClick={onCreateClick}
          className={DASHBOARD_PRIMARY_BUTTON_CLASS}
        >
          Create a route
        </Button>
      </div>
    </div>
  );
}
