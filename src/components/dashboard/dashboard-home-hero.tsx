import {
  DashboardStatStrip,
  type DashboardStatStripItem,
} from "@/components/dashboard/dashboard-stat-strip";
import { DashboardHomeResizeItem } from "@/components/dashboard/dashboard-home-resize-motion";
import {
  DASHBOARD_HOME_HERO,
  DASHBOARD_HOME_HERO_STAT_STRIP,
} from "@/components/dashboard/dashboard-surface";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

const HERO_BACKGROUND = PUBLIC_ASSETS.dashboard.homeHero.png;

type DashboardHomeHeroProps = {
  greeting: string;
  subheading?: string;
  stats: DashboardStatStripItem[];
  className?: string;
};

export function DashboardHomeHero({
  greeting,
  subheading = "Here is how we are looking today.",
  stats,
  className,
}: DashboardHomeHeroProps) {
  return (
    <DashboardHomeResizeItem
      className={cn(
        DASHBOARD_HOME_HERO,
        "aspect-[5/1] min-h-[220px] max-h-[240px] shrink-0 bg-cover bg-right bg-no-repeat",
        className,
      )}
      style={{ backgroundImage: `url('${HERO_BACKGROUND}')` }}
    >
      <div className="relative flex h-full flex-col justify-between gap-4 p-5 lg:p-6">
        <div className="min-w-0 max-w-[min(100%,34rem)]">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[28px]">
            {greeting}
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
            {subheading}
          </p>
        </div>

        <div className={DASHBOARD_HOME_HERO_STAT_STRIP}>
          <DashboardStatStrip stats={stats} variant="heroGlass" />
        </div>
      </div>
    </DashboardHomeResizeItem>
  );
}
