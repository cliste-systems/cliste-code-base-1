"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export async function unlockDashboardPreviewGate(
  formData: FormData
): Promise<void> {
  const password = formData.get("password");
  if (typeof password !== "string") {
    redirect("/dashboard-unlock?error=1");
  }

  const secret = process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim();
  if (!secret) {
    redirect("/dashboard-unlock?error=config");
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    redirect("/dashboard-unlock?error=1");
  }

  const jar = await cookies();
  jar.set("cliste_dashboard_gate", secret, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}
