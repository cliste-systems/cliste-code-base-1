/**
 * Store plain handles in the database; build full profile URLs at render time.
 * Accepts pasted URLs or @handles on input; save path normalizes to a handle (or id query for FB profile.php).
 */

const IG_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "tv",
  "direct",
]);

function tryParseInstagramUsernameFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "");
    if (!host.endsWith("instagram.com")) return null;
    const segments = u.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (segments.length === 0) return null;
    const head = segments[0].toLowerCase();
    if (IG_RESERVED.has(head)) {
      if ((head === "reel" || head === "reels") && segments[1]) {
        return sanitizeHandle(segments[1]);
      }
      return null;
    }
    return sanitizeHandle(segments[0]);
  } catch {
    return null;
  }
}

const FB_PATH_SKIP = new Set([
  "pages",
  "groups",
  "share",
  "watch",
  "marketplace",
  "events",
  "photo.php",
  "story.php",
]);

function tryParseFacebookPathFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^(www|m|web)\./i, "");
    if (!/^(facebook\.com|fb\.com|fb\.me)$/i.test(host)) return null;
    const idParam = u.searchParams.get("id");
    if (u.pathname.includes("profile.php") && idParam) {
      return `profile.php?id=${idParam}`;
    }
    const segments = u.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (segments.length === 0) return null;
    const head = segments[0].toLowerCase();
    if (FB_PATH_SKIP.has(head)) {
      if (head === "pages" && segments.length >= 2) {
        const last = segments[segments.length - 1];
        if (/^\d+$/.test(last)) return last;
        return sanitizeHandle(segments[1]);
      }
      return null;
    }
    return sanitizeHandle(segments[0]);
  } catch {
    return null;
  }
}

function sanitizeHandle(s: string): string | null {
  const t = s.replace(/^@+/, "").trim();
  if (!t) return null;
  return t;
}

/** Normalize user input to a value safe to store (handle or profile.php?id=…). */
export function normalizeInstagramHandleForStorage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /instagram\.com/i.test(t)) {
    return tryParseInstagramUsernameFromUrl(t);
  }
  return sanitizeHandle(t);
}

export function normalizeFacebookHandleForStorage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /facebook\.com|fb\.com|fb\.me/i.test(t)) {
    return tryParseFacebookPathFromUrl(t);
  }
  return sanitizeHandle(t);
}

/** Show stored value in form fields (convert legacy full URLs to handles). */
export function instagramStoredToFormValue(stored: string | null | undefined): string {
  if (!stored?.trim()) return "";
  const t = stored.trim();
  if (/^https?:\/\//i.test(t) || /instagram\.com/i.test(t)) {
    return tryParseInstagramUsernameFromUrl(t) ?? t;
  }
  return t.replace(/^@+/, "");
}

export function facebookStoredToFormValue(stored: string | null | undefined): string {
  if (!stored?.trim()) return "";
  const t = stored.trim();
  if (/^https?:\/\//i.test(t) || /facebook\.com|fb\.com|fb\.me/i.test(t)) {
    return tryParseFacebookPathFromUrl(t) ?? t;
  }
  return t.replace(/^@+/, "");
}

export function instagramStoredToHref(stored: string | null | undefined): string | null {
  const t = stored?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const handle = normalizeInstagramHandleForStorage(t);
  return handle ? `https://instagram.com/${handle}` : null;
}

export function facebookStoredToHref(stored: string | null | undefined): string | null {
  const t = stored?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const handle = normalizeFacebookHandleForStorage(t);
  if (!handle) return null;
  if (handle.startsWith("profile.php?")) {
    return `https://www.facebook.com/${handle}`;
  }
  return `https://www.facebook.com/${handle}`;
}
