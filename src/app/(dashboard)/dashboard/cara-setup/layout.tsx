import { DASHBOARD_PAGE_SHELL_FILL_WHITE, DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

import { CaraSetupFormProvider } from "./cara-setup-form-context";
import { CaraSetupShell } from "./cara-setup-shell";
import { loadCaraSetupPageData } from "./load-cara-setup";

export const dynamic = "force-dynamic";

export default async function CaraSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initial, businessFiles, promptExtras } = await loadCaraSetupPageData();

  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
        <CaraSetupFormProvider
          initial={initial}
          businessFiles={businessFiles}
          promptExtras={promptExtras}
        >
          <CaraSetupShell>{children}</CaraSetupShell>
        </CaraSetupFormProvider>
      </div>
    </div>
  );
}
