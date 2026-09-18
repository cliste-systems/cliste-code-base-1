"use client";

import { useEffect } from "react";

/** Scroll the dashboard form region to the element matching the URL hash. */
export function useDashboardHashScroll(pathname: string) {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const scrollToTarget = () => {
      const target = document.getElementById(hash);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const frame = window.requestAnimationFrame(scrollToTarget);
    const timer = window.setTimeout(scrollToTarget, 150);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname]);
}
