"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  dashboardVerticalCopy,
  type DashboardVerticalCopy,
} from "@/lib/dashboard-vertical-copy";
import type { VerticalPack } from "@/lib/verticals";

export type DashboardVerticalContextValue = {
  niche: string;
  vertical: VerticalPack;
  copy: DashboardVerticalCopy;
  businessName: string;
  storePhoneE164: string;
};

const DashboardVerticalContext =
  createContext<DashboardVerticalContextValue | null>(null);

export function DashboardVerticalProvider({
  niche,
  businessType,
  businessName,
  storePhoneE164,
  children,
}: {
  niche: string | null | undefined;
  businessType?: string | null;
  businessName: string;
  storePhoneE164?: string | null;
  children: ReactNode;
}) {
  const value = useMemo((): DashboardVerticalContextValue => {
    const copy = dashboardVerticalCopy(niche, businessType);
    return {
      niche: copy.niche,
      vertical: copy.vertical,
      copy,
      businessName: businessName.trim() || "Your business",
      storePhoneE164: storePhoneE164?.trim() ?? "",
    };
  }, [niche, businessType, businessName, storePhoneE164]);

  return (
    <DashboardVerticalContext.Provider value={value}>
      {children}
    </DashboardVerticalContext.Provider>
  );
}

export function useDashboardVertical(): DashboardVerticalContextValue {
  const ctx = useContext(DashboardVerticalContext);
  if (!ctx) {
    throw new Error(
      "useDashboardVertical must be used within DashboardVerticalProvider",
    );
  }
  return ctx;
}
