"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, Trash2 } from "lucide-react";

import {
  createSupportDashboardLink,
  deleteOrganization,
} from "./actions";

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
  const [rowError, setRowError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [loginPending, startLoginTransition] = useTransition();

  const openSupportDashboard = useCallback(() => {
    setRowError(null);
    startLoginTransition(async () => {
      const result = await createSupportDashboardLink(
        organizationId,
        typeof window !== "undefined" ? window.location.origin : null
      );
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      const w = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!w) {
        window.location.assign(result.url);
      }
    });
  }, [organizationId]);

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
          <button
            type="button"
            disabled={loginPending}
            onClick={openSupportDashboard}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 focus:outline-none disabled:opacity-60"
          >
            <LogIn className="size-3.5 text-gray-400" aria-hidden />
            {loginPending ? "Opening…" : "Open dashboard"}
          </button>
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
        {rowError ? (
          <p className="max-w-[14rem] text-right text-xs leading-snug text-red-600">
            {rowError}
          </p>
        ) : null}
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
