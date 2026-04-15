"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  markDashboardNavSeen,
  type DashboardNavSeenKey,
} from "./nav-seen-actions";

function pathnameToSeenKey(pathname: string | null): DashboardNavSeenKey | null {
  if (!pathname) return null;
  const routes: { prefix: string; key: DashboardNavSeenKey }[] = [
    { prefix: "/dashboard/call-history", key: "call-history" },
    { prefix: "/dashboard/action-inbox", key: "action-inbox" },
    { prefix: "/dashboard/calendar", key: "calendar" },
    { prefix: "/dashboard/bookings", key: "bookings" },
  ];
  for (const { prefix, key } of routes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return null;
}

/**
 * When the user opens Call History, Action Inbox, Calendar, or Bookings, persist
 * “seen” via a Server Action so the next layout render reads the cookie (middleware
 * alone is not visible to RSC on the same round-trip).
 */
export function DashboardNavSeenSync() {
  const pathname = usePathname();
  const router = useRouter();
  const seq = useRef(0);

  useEffect(() => {
    const key = pathnameToSeenKey(pathname);
    if (!key) return;

    const id = ++seq.current;
    let cancelled = false;

    void (async () => {
      try {
        await markDashboardNavSeen(key);
      } catch {
        /* ignore */
      }
      if (cancelled || id !== seq.current) return;
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
