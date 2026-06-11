import Image from "next/image";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: number;
  priority?: boolean;
};

import { PUBLIC_ASSETS } from "@/lib/public-assets";

/** Cliste speech-bubble mark (RGBA PNG). */
export function ClisteLogoMark({
  className,
  size = 48,
  priority = false,
}: Props) {
  return (
    <Image
      src={PUBLIC_ASSETS.logo}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
