"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DEV_TIER_COOKIE,
  DEV_TIER_MAX_AGE_SECONDS,
  type DevProductTier,
} from "@/lib/dev-tier";

function writeTierCookie(tier: DevProductTier) {
  document.cookie = `${DEV_TIER_COOKIE}=${tier};path=/;max-age=${DEV_TIER_MAX_AGE_SECONDS};SameSite=Lax`;
}

type DevTierSwitcherProps = {
  initialTier: DevProductTier;
};

export function DevTierSwitcher({ initialTier }: DevTierSwitcherProps) {
  const router = useRouter();
  const [tier, setTier] = useState<DevProductTier>(initialTier);

  useEffect(() => {
    setTier(initialTier);
  }, [initialTier]);

  const cycle = () => {
    const next: DevProductTier = tier === "native" ? "connect" : "native";
    setTier(next);
    writeTierCookie(next);
    router.refresh();
  };

  return (
    <div className="fixed bottom-8 left-8 z-50 hidden md:block">
      <Button
        type="button"
        variant="secondary"
        className="inline-flex h-auto items-center rounded-full border border-gray-200/80 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-md hover:bg-white"
        onClick={cycle}
        title="Toggle Connect vs Native preview (dev cookie)"
      >
        <span className="border-r border-gray-200 pr-2 text-[10px] font-medium tracking-widest text-gray-500 uppercase">
          Tier
        </span>
        <span className="pl-2 text-xs font-medium capitalize text-gray-900">
          {tier} dev
        </span>
      </Button>
    </div>
  );
}
