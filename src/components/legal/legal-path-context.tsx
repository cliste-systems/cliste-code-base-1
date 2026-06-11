"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

type LegalPathVariant = "public" | "dashboard";

const LegalPathContext = createContext<LegalPathVariant>("public");

export function LegalPathProvider({
  variant,
  children,
}: {
  variant: LegalPathVariant;
  children: ReactNode;
}) {
  return (
    <LegalPathContext.Provider value={variant}>{children}</LegalPathContext.Provider>
  );
}

export function useLegalPathVariant(): LegalPathVariant {
  return useContext(LegalPathContext);
}

export function resolveLegalHref(href: string, variant: LegalPathVariant): string {
  if (href.startsWith("/dashboard/")) return href;
  if (variant === "dashboard" && href.startsWith("/legal/")) {
    return href.replace("/legal/", "/dashboard/legal/");
  }
  return href;
}

export function LegalInlineLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const variant = useLegalPathVariant();
  const resolved = resolveLegalHref(href, variant);
  const className =
    "font-medium text-[#0b1220] underline-offset-2 hover:underline";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={resolved} className={className}>
      {children}
    </Link>
  );
}
