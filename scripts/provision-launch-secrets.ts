/**
 * Provision launch-hardening secrets across Vercel + Cloudflare.
 *
 * Requires (load from .env.local or environment):
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   CF_ZONE_ID_HELLOCARA   — hellocara.ie zone (app.hellocara.ie)
 *   CF_ZONE_ID_CLISTE      — optional legacy clistesystems.ie zone
 *   VERCEL_TOKEN
 *   VERCEL_TEAM_SLUG       — default clistes-projects
 *   VERCEL_PROJECT_NAME    — default cliste-code-base-1
 *
 * Reuses existing secret values when already set in the environment.
 *
 * Run:
 *   npx tsx scripts/provision-launch-secrets.ts
 */

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { config } from "dotenv";

config({ path: ".env.local" });

const ENV_LOCAL = join(process.cwd(), ".env.local");
const EDGE_HEADER = "x-cliste-edge";

type LaunchSecrets = {
  CLISTE_EDGE_SHARED_SECRET: string;
  AUTH_RATE_LIMIT_SALT: string;
  CLISTE_SUPPORT_DASHBOARD_SECRET: string;
};

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function resolveSecrets(): LaunchSecrets {
  return {
    CLISTE_EDGE_SHARED_SECRET:
      process.env.CLISTE_EDGE_SHARED_SECRET?.trim() || generateSecret(),
    AUTH_RATE_LIMIT_SALT:
      process.env.AUTH_RATE_LIMIT_SALT?.trim() || generateSecret(),
    CLISTE_SUPPORT_DASHBOARD_SECRET:
      process.env.CLISTE_SUPPORT_DASHBOARD_SECRET?.trim() || generateSecret(),
  };
}

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function renderEnv(map: Map<string, string>): string {
  const preferred = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLISTE_ADMIN_SECRET",
    "SUPABASE_ACCESS_TOKEN",
    "CLISTE_EDGE_SHARED_SECRET",
    "AUTH_RATE_LIMIT_SALT",
    "CLISTE_SUPPORT_DASHBOARD_SECRET",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CF_ZONE_ID_HELLOCARA",
    "CF_ZONE_ID_CLISTE",
    "VERCEL_TOKEN",
    "VERCEL_TEAM_SLUG",
    "VERCEL_PROJECT_NAME",
  ];
  const lines = ["# Generated/updated by scripts/provision-launch-secrets.ts", ""];
  const written = new Set<string>();
  for (const key of preferred) {
    const value = map.get(key);
    if (value == null) continue;
    lines.push(`${key}=${value}`);
    written.add(key);
  }
  for (const [key, value] of map.entries()) {
    if (written.has(key)) continue;
    lines.push(`${key}=${value}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function updateEnvLocal(secrets: LaunchSecrets): Promise<void> {
  let map = new Map<string, string>();
  try {
    map = parseEnv(await readFile(ENV_LOCAL, "utf8"));
  } catch {
    // new file
  }
  for (const [key, value] of Object.entries(secrets)) {
    map.set(key, value);
  }
  await writeFile(ENV_LOCAL, renderEnv(map), "utf8");
  console.log("Updated .env.local with launch secrets.");
}

async function cfRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: T;
  };
  if (!response.ok || json.success === false) {
    throw new Error(
      `Cloudflare ${method} ${path} failed: ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json.result as T;
}

async function ensureEdgeHeaderTransformRule(
  token: string,
  zoneId: string,
  zoneLabel: string,
  edgeSecret: string,
): Promise<void> {
  let existingRules: Array<{
    description?: string;
    action?: string;
    expression?: string;
    action_parameters?: unknown;
  }> = [];

  try {
    const entrypoint = await cfRequest<{ id: string; rules?: unknown[] }>(
      token,
      "GET",
      `/zones/${zoneId}/rulesets/phases/http_request_late_transform/entrypoint`,
    );
    existingRules = (entrypoint?.rules ?? []) as typeof existingRules;
  } catch {
    // No entrypoint ruleset yet — create below via PUT.
  }

  const otherRules = existingRules.filter(
    (rule) => rule.description !== "Cliste inject x-cliste-edge header",
  );

  const edgeRule = {
    description: "Cliste inject x-cliste-edge header",
    enabled: true,
    expression:
      '(http.host eq "app.hellocara.ie" or http.host eq "app.clistesystems.ie")',
    action: "rewrite",
    action_parameters: {
      headers: {
        [EDGE_HEADER]: {
          operation: "set",
          value: edgeSecret,
        },
      },
    },
  };

  await cfRequest(
    token,
    "PUT",
    `/zones/${zoneId}/rulesets/phases/http_request_late_transform/entrypoint`,
    {
      description: "Cliste launch hardening request header transforms",
      rules: [...otherRules, edgeRule],
    },
  );

  console.log(`OK   Cloudflare transform rule on ${zoneLabel} (${zoneId})`);
}

async function provisionCloudflare(edgeSecret: string): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    console.warn("SKIP Cloudflare — CLOUDFLARE_API_TOKEN not set.");
    return;
  }

  const zones: Array<{ id: string; label: string }> = [];
  const helloZone = process.env.CF_ZONE_ID_HELLOCARA?.trim();
  const clisteZone =
    process.env.CF_ZONE_ID_CLISTE?.trim() ||
    process.env.CF_ZONE_ID?.trim() ||
    "e9ea0e6e4429f528631bb2a1ae4628d0";

  if (helloZone) zones.push({ id: helloZone, label: "hellocara.ie" });
  if (clisteZone) zones.push({ id: clisteZone, label: "clistesystems.ie" });

  if (zones.length === 0) {
    const listed = await cfRequest<
      Array<{ id: string; name: string }>
    >(token, "GET", "/zones?per_page=50");
    for (const zone of listed ?? []) {
      if (zone.name === "hellocara.ie" || zone.name === "clistesystems.ie") {
        zones.push({ id: zone.id, label: zone.name });
      }
    }
  }

  if (zones.length === 0) {
    throw new Error("No Cloudflare zones found for hellocara.ie / clistesystems.ie.");
  }

  const seen = new Set<string>();
  for (const zone of zones) {
    if (seen.has(zone.id)) continue;
    seen.add(zone.id);
    await ensureEdgeHeaderTransformRule(token, zone.id, zone.label, edgeSecret);
  }
}

async function vercelRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const team = process.env.VERCEL_TEAM_SLUG?.trim() || "clistes-projects";
  const url = new URL(`https://api.vercel.com${path}`);
  url.searchParams.set("teamId", team);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(
      `Vercel ${method} ${path} failed (${response.status}): ${json.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json;
}

async function upsertVercelEnv(
  token: string,
  projectId: string,
  key: string,
  value: string,
): Promise<void> {
  const listed = await vercelRequest<{ envs: Array<{ id: string; key: string }> }>(
    token,
    "GET",
    `/v9/projects/${projectId}/env`,
  );
  const existing = listed.envs?.find((row) => row.key === key);
  if (existing?.id) {
    await vercelRequest(token, "PATCH", `/v9/projects/${projectId}/env/${existing.id}`, {
      value,
      target: ["production", "preview"],
      type: "encrypted",
    });
    console.log(`OK   Vercel env updated: ${key}`);
    return;
  }

  await vercelRequest(token, "POST", `/v10/projects/${projectId}/env`, {
    key,
    value,
    type: "encrypted",
    target: ["production", "preview"],
  });
  console.log(`OK   Vercel env created: ${key}`);
}

async function provisionVercel(secrets: LaunchSecrets): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.warn("SKIP Vercel — VERCEL_TOKEN not set.");
    return;
  }

  const projectName =
    process.env.VERCEL_PROJECT_NAME?.trim() || "cliste-code-base-1";
  const projects = await vercelRequest<{ projects: Array<{ id: string; name: string }> }>(
    token,
    "GET",
    `/v9/projects?search=${encodeURIComponent(projectName)}`,
  );
  const project =
    projects.projects?.find((p) => p.name === projectName) ?? projects.projects?.[0];
  if (!project?.id) {
    throw new Error(`Vercel project ${projectName} not found.`);
  }

  for (const [key, value] of Object.entries(secrets)) {
    await upsertVercelEnv(token, project.id, key, value);
  }
}

async function main() {
  const secrets = resolveSecrets();
  await updateEnvLocal(secrets);

  console.log("\n== Cloudflare x-cliste-edge transform ==");
  await provisionCloudflare(secrets.CLISTE_EDGE_SHARED_SECRET);

  console.log("\n== Vercel production env vars ==");
  await provisionVercel(secrets);

  console.log("\nDone. Redeploy Vercel production after env changes.");
  console.log("Verify: curl -I https://app.hellocara.ie should not 403 via Cloudflare.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
