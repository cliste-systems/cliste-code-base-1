import assert from "node:assert/strict";
import test from "node:test";

import {
  isProfileAvatarMimeType,
  normalizeProfileAvatarFile,
  profileAvatarPublicUrl,
  profileAvatarStoragePath,
} from "./profile-avatar";

test("profileAvatarStoragePath scopes uploads to the user id", () => {
  assert.equal(
    profileAvatarStoragePath("11111111-1111-1111-1111-111111111111"),
    "11111111-1111-1111-1111-111111111111/avatar.webp",
  );
});

test("profileAvatarPublicUrl appends cache busting version", () => {
  assert.equal(
    profileAvatarPublicUrl(
      "https://example.supabase.co",
      "11111111-1111-1111-1111-111111111111",
      123,
    ),
    "https://example.supabase.co/storage/v1/object/public/profile-avatars/11111111-1111-1111-1111-111111111111/avatar.webp?v=123",
  );
});

test("isProfileAvatarMimeType accepts dashboard upload types", () => {
  assert.equal(isProfileAvatarMimeType("image/jpeg"), true);
  assert.equal(isProfileAvatarMimeType("image/png"), true);
  assert.equal(isProfileAvatarMimeType("application/pdf"), false);
});

test("normalizeProfileAvatarFile wraps blobs as webp files", () => {
  const blob = new Blob(["x"], { type: "image/webp" });
  const file = normalizeProfileAvatarFile(blob);
  assert.ok(file);
  assert.equal(file?.name, "avatar.webp");
  assert.equal(file?.type, "image/webp");
});
