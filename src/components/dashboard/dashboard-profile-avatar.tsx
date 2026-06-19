"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type DashboardProfileAvatarProps = {
  initials: string;
  avatarUrl?: string | null;
  previewUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-8 text-[10px]",
  md: "size-14 text-sm",
} as const;

export function DashboardProfileAvatar({
  initials,
  avatarUrl,
  previewUrl,
  size = "sm",
  className,
}: DashboardProfileAvatarProps) {
  const src = previewUrl || avatarUrl;
  const sizeClass = SIZE_CLASS[size];

  if (src) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-[#f1f5f9]",
          sizeClass,
          className,
        )}
      >
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={size === "sm" ? "32px" : "56px"}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] font-semibold tracking-tight text-[#64748b]",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
