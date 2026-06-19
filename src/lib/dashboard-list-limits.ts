/**
 * Row limits for dashboard list queries — caps Supabase egress at scale.
 * Call history uses pagination; other lists use a hard cap with newest-first ordering.
 */

export const CALL_HISTORY_PAGE_SIZE = 50;

/** Max tickets loaded on Action Inbox (newest first). */
export const ACTION_INBOX_TICKET_LIMIT = 500;

/** Related call_logs rows for inbox caller matching. */
export const ACTION_INBOX_CALL_LIMIT = 500;

/** Client rows joined for inbox caller names. */
export const ACTION_INBOX_CLIENT_LIMIT = 500;

/** Contacts page: calls used to build the contact list. */
export const CONTACTS_CALL_LIMIT = 500;

export const CONTACTS_TICKET_LIMIT = 500;

export const CONTACTS_CLIENT_LIMIT = 500;

/** Open tickets for call-history follow-up badges (not full ticket history). */
export const CALL_HISTORY_OPEN_TICKET_LIMIT = 500;

/** Activity page — merged call + ticket feed (newest first). */
export const ACTIVITY_FEED_LIMIT = 200;
