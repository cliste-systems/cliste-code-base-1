import type { Metadata } from "next";

import { BookingDisabledNotice } from "@/components/booking-disabled-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cliste",
  robots: { index: false, follow: false },
};

/**
 * v1: the public salon storefront / native booking page is retired. We keep the
 * route so existing links don't 404, but it renders a neutral non-booking
 * surface. DB tables and dashboard booking code are unchanged — see git
 * history for the previous public storefront implementation.
 */
export default function PublicSalonPage() {
  return <BookingDisabledNotice />;
}
