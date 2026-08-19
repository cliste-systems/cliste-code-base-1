import { redirect } from "next/navigation";

import { isLocalDashboardPreviewEnabled } from "@/lib/dashboard-dev";

/** `/` is not a public marketing chooser — send visitors to sign-in. */
export default function Home() {
  redirect(
    isLocalDashboardPreviewEnabled() ? "/dashboard" : "/authenticate",
  );
}
