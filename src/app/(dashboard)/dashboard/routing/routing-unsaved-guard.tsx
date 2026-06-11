"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

import { useRoutingForm } from "./routing-form-context";

export function RoutingUnsavedGuard({ children }: { children: React.ReactNode }) {
  const { isDirty, pending, saveAsync, discardChanges } = useRoutingForm();
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("/dashboard/routing")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setLeaveOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  const handleSaveAndLeave = useCallback(async () => {
    const href = pendingHref;
    const saved = await saveAsync();
    if (!saved) return;
    setLeaveOpen(false);
    setPendingHref(null);
    if (href) router.push(href);
  }, [saveAsync, pendingHref, router]);

  return (
    <>
      {children}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Unsaved changes"
        description="You have unsaved changes in Call Flow. Save them before you leave?"
        confirmLabel="Save call flow"
        cancelLabel="Stay on page"
        pending={pending}
        onConfirm={handleSaveAndLeave}
      >
        <button
          type="button"
          className="text-[13px] font-medium text-red-700 underline-offset-2 hover:underline"
          onClick={() => {
            discardChanges();
            const href = pendingHref;
            setLeaveOpen(false);
            setPendingHref(null);
            if (href) router.push(href);
          }}
        >
          Discard changes and leave
        </button>
      </ConfirmDialog>
    </>
  );
}
