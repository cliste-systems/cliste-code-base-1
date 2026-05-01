"use client";

import { useLayoutEffect } from "react";

/**
 * Locks document scroll while the dashboard shell is mounted. The shell is
 * `fixed inset-0`; without this, `html`/`body` can still scroll on macOS when
 * content height exceeds the viewport.
 */
export function DashboardViewportLock() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, []);
  return null;
}
