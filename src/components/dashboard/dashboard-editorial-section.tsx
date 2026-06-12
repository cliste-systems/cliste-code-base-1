import type { ReactNode } from "react";
import Link from "next/link";

export function DashboardSectionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium text-slate-600 transition-colors hover:text-[#0b1220]"
    >
      {children}
    </Link>
  );
}
