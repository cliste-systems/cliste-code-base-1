"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeProfileAvatarFile,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATARS_BUCKET,
  isProfileAvatarMimeType,
  profileAvatarPublicUrl,
  profileAvatarStoragePath,
} from "@/lib/profile-avatar";
import { requireDashboardSession } from "@/lib/dashboard-session";

const MAX_NAME = 80;

async function uploadProfileAvatar(
  supabase: Awaited<
    ReturnType<typeof import("@/utils/supabase/server").createClient>
  >,
  userId: string,
  avatarFile: File,
): Promise<{ ok: true; avatarUrl: string } | { ok: false; message: string }> {
  const mimeType = (avatarFile.type || "").toLowerCase();
  if (!isProfileAvatarMimeType(mimeType)) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP image." };
  }
  if (avatarFile.size > PROFILE_AVATAR_MAX_BYTES) {
    return { ok: false, message: "Image is too large (max 2 MB)." };
  }

  const storagePath = profileAvatarStoragePath(userId);
  const buffer = Buffer.from(await avatarFile.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return { ok: false, message: "Storage is not configured." };
  }

  return {
    ok: true,
    avatarUrl: profileAvatarPublicUrl(supabaseUrl, userId, Date.now()),
  };
}

/**
 * Avatar is passed explicitly — Next.js server actions do not reliably preserve
 * `File` objects nested inside client-built `FormData`.
 */
export async function updateUserProfile(
  avatar: File | null,
  formData: FormData,
): Promise<
  { ok: true; avatarUrl: string | null } | { ok: false; message: string }
> {
  const { supabase, user, isLocalPreview } = await requireDashboardSession();

  if (isLocalPreview) {
    return { ok: false, message: "Profile editing is disabled in local preview." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) {
    return { ok: false, message: "Add your display name." };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, message: "Display name is too long." };
  }

  const avatarFile =
    normalizeProfileAvatarFile(avatar) ??
    normalizeProfileAvatarFile(formData.get("avatar"));

  let avatarUrl: string | null | undefined;

  if (avatarFile) {
    const uploaded = await uploadProfileAvatar(supabase, user.id, avatarFile);
    if (!uploaded.ok) return uploaded;
    avatarUrl = uploaded.avatarUrl;
  }

  const updatePayload: {
    name: string;
    updated_at: string;
    avatar_url?: string | null;
  } = {
    name,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl !== undefined) {
    updatePayload.avatar_url = avatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    avatarUrl:
      avatarUrl !== undefined
        ? avatarUrl
        : (
            await supabase
              .from("profiles")
              .select("avatar_url")
              .eq("id", user.id)
              .maybeSingle()
          ).data?.avatar_url ?? null,
  };
}

export async function removeUserProfileAvatar(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const { supabase, user, isLocalPreview } = await requireDashboardSession();
  if (isLocalPreview) {
    return { ok: false, message: "Profile editing is disabled in local preview." };
  }

  const storagePath = profileAvatarStoragePath(user.id);
  await supabase.storage.from(PROFILE_AVATARS_BUCKET).remove([storagePath]);

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
