"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

import { useCaraSetupForm } from "./cara-setup-form-context";

type Props = {
  children: React.ReactNode;
};

export function CaraSetupUnsavedGuard({ children }: Props) {
  const { isDirty, saveAsync, pending, discardChanges } = useCaraSetupForm();
  const pathname = usePathname();
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
      if (href.startsWith("/dashboard/cara-setup")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setLeaveOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, pathname]);

  return (
    <>
      {children}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Unsaved changes"
        description="You have unsaved changes in Cara Setup. Save them before you leave?"
        confirmLabel="Save changes"
        cancelLabel="Stay on page"
        pending={pending}
        onConfirm={async () => {
          const href = pendingHref;
          const saved = await saveAsync();
          if (!saved) return;
          setLeaveOpen(false);
          setPendingHref(null);
          if (href) router.push(href);
        }}
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
