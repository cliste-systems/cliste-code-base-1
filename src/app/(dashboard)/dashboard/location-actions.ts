"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  ALL_LOCATIONS_VIEW_COOKIE,
} from "@/lib/account-locations";
import { userCanAccessOrganization } from "@/lib/account-access";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { createClient } from "@/utils/supabase/server";

export type LocationSwitchResult =
  | { ok: true }
  | { ok: false; message: string };

export async function switchDashboardLocation(
  organizationId: string,
): Promise<LocationSwitchResult> {
  const session = await requireDashboardSession();
  const trimmed = organizationId.trim();

  if (trimmed === "all") {
    const jar = await cookies();
    jar.set(ALL_LOCATIONS_VIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    jar.delete(ACTIVE_ORGANIZATION_COOKIE);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  }

  const allowed = await userCanAccessOrganization(session.user.id, trimmed);
  if (!allowed) {
    return { ok: false, message: "You do not have access to that location." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      active_organization_id: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const jar = await cookies();
  jar.set(ACTIVE_ORGANIZATION_COOKIE, trimmed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  jar.delete(ALL_LOCATIONS_VIEW_COOKIE);

  revalidatePath("/dashboard", "layout");
  revalidatePath(DASHBOARD_ROUTES.home);
  return { ok: true };
}
