"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";

export async function unlockAdminGate(formData: FormData): Promise<void> {
  const password = formData.get("password");
  if (typeof password !== "string") {
    redirect("/admin-unlock?error=1");
  }

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    redirect("/admin-unlock?error=config");
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    redirect("/admin-unlock?error=1");
  }

  (await cookies()).set(ADMIN_GATE_COOKIE, secret, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin");
}
