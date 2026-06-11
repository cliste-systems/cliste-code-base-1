import type { CaraStatusSnapshot } from "@/lib/cara-status";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type CaraSetupStep = {
  id: string;
  label: string;
  complete: boolean;
  href: string;
};

/** Derives setup checklist from existing Cara status (no extra queries). */
export function buildCaraSetupSteps(caraStatus: CaraStatusSnapshot): CaraSetupStep[] {
  const phoneConnected = caraStatus.phoneLine.value === "Connected";
  const isLive = caraStatus.isOnline;

  return [
    {
      id: "connect-number",
      label: "Connect number",
      complete: phoneConnected || isLive,
      href: DASHBOARD_ROUTES.settings,
    },
    {
      id: "add-services",
      label: "Add services",
      complete: isLive,
      href: `${DASHBOARD_ROUTES.caraSetup}/services`,
    },
    {
      id: "configure-call-flow",
      label: "Configure call flow",
      complete: isLive,
      href: DASHBOARD_ROUTES.routing,
    },
    {
      id: "test-go-live",
      label: "Test and go live",
      complete: isLive,
      href: DASHBOARD_ROUTES.caraSetup,
    },
  ];
}

export function firstIncompleteSetupHref(steps: CaraSetupStep[]): string {
  return steps.find((step) => !step.complete)?.href ?? DASHBOARD_ROUTES.caraSetup;
}
