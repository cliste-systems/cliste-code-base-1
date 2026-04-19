/**
 * CRM row sourced from the canonical `public.clients` table when possible,
 * with a legacy fallback for appointments not yet linked via `client_id`.
 */
export type ClientDisplay = {
  /**
   * `client:<uuid>` for canonical clients.
   * `profile:<uuid>` for legacy auth-user customers (no client row yet).
   * `guest:<phoneKey>` for booking-only contacts not yet promoted to a client.
   */
  id: string;
  /** Underlying `public.clients.id` if the row originates from clients. */
  clientId: string | null;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  allergies: string | null;
  totalBookings: number;
  noShows: number;
  lastVisitLabel: string;
  history: { id: string; dateLabel: string; service: string; status: string }[];
  /** false = legacy guest with no auth user; no destructive cascade is safe. */
  canDelete?: boolean;
};
