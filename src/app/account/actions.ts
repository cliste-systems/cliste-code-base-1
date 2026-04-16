"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendClientSignInCode(
  emailRaw: string,
): Promise<AuthActionResult> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) {
    return {
      ok: false,
      message:
        error.message ||
        "Could not send the sign-in code. Try again in a moment.",
    };
  }
  return { ok: true };
}

export async function verifyClientSignInCode(
  emailRaw: string,
  codeRaw: string,
): Promise<AuthActionResult> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  const token = (codeRaw ?? "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { ok: false, message: "Enter the 6-digit code from the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return {
      ok: false,
      message:
        error.message ||
        "That code didn't work. Request a new one and try again.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutClient(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

/**
 * Toggle a favourite salon for the signed-in client. RLS enforces the
 * row-level check; this action is a thin wrapper that returns the new state.
 */
export async function toggleSalonFavorite(
  organizationId: string,
): Promise<{ ok: true; liked: boolean } | { ok: false; message: string }> {
  if (
    !organizationId ||
    !/^[0-9a-f-]{10,}$/i.test(organizationId.trim())
  ) {
    return { ok: false, message: "Missing salon id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      message: "Sign in to save salons to your favourites.",
    };
  }

  const { data: existing, error: readErr } = await supabase
    .from("client_favorite_salons")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, message: readErr.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("client_favorite_salons")
      .delete()
      .eq("user_id", user.id)
      .eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/account");
    return { ok: true, liked: false };
  }

  const { error } = await supabase
    .from("client_favorite_salons")
    .insert({ user_id: user.id, organization_id: organizationId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/account");
  return { ok: true, liked: true };
}
