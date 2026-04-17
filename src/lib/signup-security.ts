import "server-only";

/**
 * Lightweight self-serve signup fraud checks. Returns a score (0–100) plus
 * human-readable reasons; high scores route the new org into the admin
 * review queue instead of auto-approving it onto the platform.
 *
 * Cheap checks only: disposable-email domain list, string heuristics on the
 * salon name. Not a replacement for Stripe's KYC — that runs in the wizard's
 * "payments" step and blocks live calls regardless of score.
 */

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "trashmail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "getairmail.com",
  "dispostable.com",
]);

const SUSPICIOUS_SALON_NAME_RE = /\b(test|qa|asdf|fake|bot|demo\d+)\b/i;

export type FraudScoreResult = {
  score: number;
  reasons: string[];
};

export function scoreSignupFraud(opts: {
  email: string;
  salonName: string;
  signupIp?: string | null;
  userAgent?: string | null;
}): FraudScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const domain = opts.email.split("@")[1]?.toLowerCase().trim() ?? "";
  if (!domain) {
    score += 80;
    reasons.push("Missing email domain.");
  } else if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    score += 60;
    reasons.push(`Disposable email domain (${domain}).`);
  } else if (/^\d+\./.test(domain)) {
    // Signup from what looks like an IP literal as the mail domain.
    score += 20;
    reasons.push("Email domain looks like an IP literal.");
  }

  if (SUSPICIOUS_SALON_NAME_RE.test(opts.salonName)) {
    score += 25;
    reasons.push("Salon name contains testing keywords.");
  }
  if (opts.salonName.trim().length < 3) {
    score += 20;
    reasons.push("Salon name is implausibly short.");
  }

  const ua = (opts.userAgent ?? "").toLowerCase();
  if (ua && (ua.includes("curl/") || ua.includes("python-requests") || ua.includes("httpx"))) {
    score += 40;
    reasons.push("User agent looks automated.");
  }

  return { score: Math.min(score, 100), reasons };
}

export function shouldRouteToReview(score: number): boolean {
  return score >= 40;
}
