import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — canonical Cara Setup lives under /dashboard/cara-setup. */
export default function AgentSetupPage() {
  redirect("/dashboard/cara-setup/general");
}
