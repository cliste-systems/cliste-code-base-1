import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Extra dashboard password gate removed — send bookmarks to the real dashboard. */
export default function DashboardUnlockPage() {
  redirect("/dashboard");
}
