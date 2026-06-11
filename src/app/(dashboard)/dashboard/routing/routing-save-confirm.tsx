"use client";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { useDashboardVertical } from "../../dashboard-vertical-context";

type RoutesPersistConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  routeCount: number;
};

/** Shown before persisting routes to the server (goes live on calls). */
export function RoutesPersistConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  routeCount,
}: RoutesPersistConfirmProps) {
  const { copy } = useDashboardVertical();
  const countLabel =
    routeCount === 0
      ? "You have no routes yet"
      : `${routeCount} route${routeCount === 1 ? "" : "s"}`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save call flow for live calls?"
      description={`This is what Cara uses on real calls—the actions in your call flow (${copy.routing.saveConfirmLinkNoun}, directions, Action Inbox, and more). ${countLabel} will be saved and used the next time someone rings. Edits you have not saved yet are not active.`}
      confirmLabel={pending ? "Saving…" : "Save call flow"}
      cancelLabel="Keep editing"
      onConfirm={onConfirm}
      pending={pending}
    />
  );
}
