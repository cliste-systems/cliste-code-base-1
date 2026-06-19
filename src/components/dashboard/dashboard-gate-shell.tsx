import type { ReactNode } from "react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";

type DashboardGateShellProps = {
  children: ReactNode;
};

/** Minimal chrome while legal or password setup is still outstanding. */
export function DashboardGateShell({ children }: DashboardGateShellProps) {
  return (
    <div className="fixed inset-0 z-10 flex min-h-dvh flex-col overflow-hidden bg-[#f8fafc] text-[#0b1220]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8">
          <ClisteLogoMark size={48} priority className="shrink-0" />
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}
