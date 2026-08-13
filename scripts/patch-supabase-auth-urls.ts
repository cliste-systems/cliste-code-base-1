/**
 * Patch hosted Supabase Auth URL settings (site URL + redirect allow list).
 *
 * Requires a Supabase personal access token with auth_config_write:
 *   - `supabase login` (writes ~/.supabase/access-token), or
 *   - SUPABASE_ACCESS_TOKEN in the environment / .env.local
 *
 * Run:
 *   npx tsx scripts/patch-supabase-auth-urls.ts
 */

import { DEFAULT_APP_SITE_URL } from "../src/lib/company-details";
import { SIGNUP_EMAIL_OTP_LENGTH } from "../src/lib/signup-email-otp";

const PROJECT_REF = "rtoebbwzwxcnscsxghww";
const SITE_URL = DEFAULT_APP_SITE_URL;
const REDIRECT_URLS = [
  `${DEFAULT_APP_SITE_URL}/auth/callback`,
  "http://localhost:3000/auth/callback",
  "http://localhost:3001/auth/callback",
  "http://127.0.0.1:3000/auth/callback",
];

type AuthConfig = {
  site_url?: string;
  uri_allow_list?: string;
  mailer_otp_length?: number;
};

function parseAllowList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatAllowList(urls: string[]): string {
  return [...new Set(urls)].join(",");
}

async function readAccessToken(): Promise<string> {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }

  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const cliTokenPath = path.join(os.homedir(), ".supabase", "access-token");
  try {
    const cliToken = (await fs.readFile(cliTokenPath, "utf8")).trim();
    if (cliToken) return cliToken;
  } catch {
    // fall through
  }

  const envLocalPath = path.join(process.cwd(), ".env.local");
  try {
    const envLocal = await fs.readFile(envLocalPath, "utf8");
    const match = envLocal.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
    if (match?.[1]?.trim()) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through
  }

  throw new Error(
    "No Supabase access token. Run `supabase login` or set SUPABASE_ACCESS_TOKEN.",
  );
}

async function managementFetch(
  token: string,
  method: "GET" | "PATCH",
  body?: Record<string, unknown>,
): Promise<AuthConfig> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Management API ${method} failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }

  return text ? (JSON.parse(text) as AuthConfig) : {};
}

async function main() {
  const token = await readAccessToken();
  const current = await managementFetch(token, "GET");
  const mergedRedirects = formatAllowList([
    ...parseAllowList(current.uri_allow_list),
    ...REDIRECT_URLS,
  ]);

  const patch = {
    site_url: SITE_URL,
    uri_allow_list: mergedRedirects,
    mailer_otp_length: SIGNUP_EMAIL_OTP_LENGTH,
  };

  const updated = await managementFetch(token, "PATCH", patch);

  console.log("Supabase Auth config updated:");
  console.log(`  site_url: ${updated.site_url ?? SITE_URL}`);
  console.log(`  uri_allow_list: ${updated.uri_allow_list ?? mergedRedirects}`);
  console.log(
    `  mailer_otp_length: ${updated.mailer_otp_length ?? SIGNUP_EMAIL_OTP_LENGTH}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
