import type { Metadata } from "next";

import { BookingDisabledNotice } from "@/components/booking-disabled-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cliste",
  robots: { index: false, follow: false },
};

/**
 * v1: native online booking (and its payment/success flow) is retired. The
 * route is kept so old confirmation links resolve to a neutral surface instead
 * of 404-ing. Booking/payment code and DB tables are untouched.
 */
export default function BookingSuccessPage() {
  return <BookingDisabledNotice />;
}
