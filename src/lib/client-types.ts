/** CRM row from `profiles` and/or appointments (guests keyed by phone). */
export type ClientDisplay = {
  id: string;
  name: string;
  phone: string;
  totalBookings: number;
  noShows: number;
  lastVisitLabel: string;
  history: { id: string; dateLabel: string; service: string }[];
  /** false = booking-only guest (`guest:<phone>` id); no auth user to delete. */
  canDelete?: boolean;
};
