"use client";

import { useCallback, useState, useTransition } from "react";

import { SupportDashboardOpenDialog } from "@/components/admin/support-dashboard-open-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

import { deleteOrganization } from "./actions";

type TenantRowActionsProps = {
  organizationId: string;
  organizationName: string;
};

export function TenantRowActions({
  organizationId,
  organizationName,
}: TenantRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const confirmDelete = useCallback(() => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteOrganization(organizationId);
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      setDeleteOpen(false);
    });
  }, [organizationId]);

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SupportDashboardOpenDialog
            organizationId={organizationId}
            compact
            triggerLabel="Open dashboard"
          />
          <button
            type="button"
            disabled={deletePending}
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 focus:ring-2 focus:ring-red-200 focus:outline-none disabled:opacity-60"
          >
            <Trash2 className="size-3.5 text-red-500" aria-hidden />
            Delete tenant
          </button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tenant</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="text-foreground font-medium">
                {organizationName}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={confirmDelete}
            >
              {deletePending ? "Deleting…" : "Delete tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
