"use client";

import { CARA_VERSION } from "@/lib/dashboard-versions";
import { DASHBOARD_HOME_FOOTER_BANNER_HEIGHT_PX } from "@/lib/dashboard-home-panel-limit";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

const FOOTER_BACKGROUND = PUBLIC_ASSETS.dashboard.homeFooter.png.trim();

const FOOTER_SHELL =
  "relative shrink-0 rounded-[22px] border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)]";

type Props = {
  className?: string;
};

export function DashboardHomeFooterBanner({ className }: Props) {
  return (
    <section
      className={cn(FOOTER_SHELL, className)}
      style={{ height: DASHBOARD_HOME_FOOTER_BANNER_HEIGHT_PX }}
      aria-label="Meet Cara"
    >
      {FOOTER_BACKGROUND ? (
        <div
          className="absolute inset-0 overflow-hidden rounded-[22px] bg-cover bg-[center_right] bg-no-repeat"
          style={{ backgroundImage: `url('${FOOTER_BACKGROUND}')` }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-100 to-slate-50"
          aria-hidden
        />
      )}

      <div className="relative flex h-full items-center px-6 sm:px-8">
        <div className="min-w-0 max-w-[min(100%,22rem)]">
          <p className="text-[11px] font-medium text-slate-500">
            Cara v{CARA_VERSION} is live
          </p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[24px]">
            Meet Cara
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-slate-600 sm:leading-relaxed">
            Your Irish receptionist for calls and captured requests.
          </p>
        </div>
      </div>
    </section>
  );
}
