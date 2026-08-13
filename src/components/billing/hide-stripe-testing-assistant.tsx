"use client";

import { useEffect } from "react";

/** Stripe sandbox assistant can persist on the page after leaving checkout. */
function hideStripeTestingAssistantPill() {
  for (const el of document.querySelectorAll("body > div, body > iframe")) {
    if (!(el instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    const text = el.textContent?.trim().toLowerCase() ?? "";
    if (!text.startsWith("stripe")) continue;
    el.style.setProperty("display", "none", "important");
  }
}

export function HideStripeTestingAssistant() {
  useEffect(() => {
    hideStripeTestingAssistantPill();
    const observer = new MutationObserver(hideStripeTestingAssistantPill);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
