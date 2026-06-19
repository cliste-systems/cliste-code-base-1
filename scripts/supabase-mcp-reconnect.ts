/**
 * Reconnect Supabase MCP in Cursor (PAT-based — no OAuth loop).
 *
 *   npm run supabase:mcp-reconnect          # check token, write .cursor/mcp.json, print steps
 *   npm run supabase:mcp-reconnect -- --check   # diagnostics only
 *   npm run supabase:mcp-reconnect -- --open      # open token page in browser
 *   npm run supabase:mcp-reconnect -- --login     # supabase login → sync token to .env.local
 *
 * Needs SUPABASE_ACCESS_TOKEN in .env.local (or ~/.supabase/access-token after login).
 * Generate at https://supabase.com/dashboard/account/tokens
 */

import { execSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import { config } from "dotenv";

const PROJECT_REF = "rtoebbwzwxcnscsxghww";
const TOKEN_URL = "https://supabase.com/dashboard/account/tokens";
const MCP_DIR = join(process.cwd(), ".cursor");
const MCP_PATH = join(MCP_DIR, "mcp.json");
const ENV_LOCAL = join(process.cwd(), ".env.local");

type McpFile = {
  mcpServers?: Record<string, unknown>;
};

async function readAccessToken(): Promise<string | null> {
  config({ path: ".env.local" });

  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const cliToken = (
      await readFile(join(homedir(), ".supabase", "access-token"), "utf8")
    ).trim();
    if (cliToken) return cliToken;
  } catch {
    // no CLI token
  }

  return null;
}

function openUrl(url: string): void {
  const os = platform();
  const cmd =
    os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open";
  try {
    execSync(`${cmd} ${JSON.stringify(url)}`, { stdio: "ignore" });
  } catch {
    // best effort
  }
}

async function verifyToken(token: string): Promise<boolean> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.ok;
}

function supabaseMcpServerEntry(token: string): Record<string, unknown> {
  return {
    command: "npx",
    args: [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      `--project-ref=${PROJECT_REF}`,
    ],
    env: {
      SUPABASE_ACCESS_TOKEN: token,
    },
  };
}

async function writeProjectMcpConfig(token: string): Promise<void> {
  let existing: McpFile = {};
  try {
    existing = JSON.parse(await readFile(MCP_PATH, "utf8")) as McpFile;
  } catch {
    // new file
  }

  const merged: McpFile = {
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      supabase: supabaseMcpServerEntry(token),
    },
  };

  await mkdir(MCP_DIR, { recursive: true });
  await writeFile(MCP_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

async function syncCliTokenToEnvLocal(): Promise<string | null> {
  try {
    const cliToken = (
      await readFile(join(homedir(), ".supabase", "access-token"), "utf8")
    ).trim();
    if (!cliToken) return null;

    let envText = "";
    try {
      envText = await readFile(ENV_LOCAL, "utf8");
    } catch {
      envText = "";
    }

    if (/^SUPABASE_ACCESS_TOKEN=/m.test(envText)) {
      envText = envText.replace(
        /^SUPABASE_ACCESS_TOKEN=.*$/m,
        `SUPABASE_ACCESS_TOKEN=${cliToken}`,
      );
    } else {
      envText = `${envText.trimEnd()}\nSUPABASE_ACCESS_TOKEN=${cliToken}\n`;
    }

    await writeFile(ENV_LOCAL, envText, "utf8");
    return cliToken;
  } catch {
    return null;
  }
}

function runSupabaseLogin(): void {
  console.log("Opening Supabase CLI login…");
  const result = spawnSync("npx", ["supabase@latest", "login"], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("supabase login failed or was cancelled.");
  }
}

function printReconnectSteps(wroteConfig: boolean): void {
  console.log("");
  if (wroteConfig) {
    console.log(`Wrote ${MCP_PATH}`);
  }
  console.log("In Cursor:");
  console.log("  1. Cmd+Shift+P → Developer: Reload Window");
  console.log("  2. Settings → Tools & MCP");
  console.log("  3. Find “supabase” — toggle off, then on if status is red");
  console.log("  4. Ask the agent to apply pending migrations");
  console.log("");
  console.log("Fallback (no MCP):");
  console.log(
    "  npx tsx scripts/apply-remote-sql.ts supabase/migrations/081_business_files_cara_metadata.sql",
  );
}

function printMissingTokenHelp(): void {
  console.log("No Supabase access token found.\n");
  console.log("Option A — personal access token (recommended for MCP):");
  console.log(`  1. Create one at ${TOKEN_URL}`);
  console.log("  2. Add to .env.local:");
  console.log("       SUPABASE_ACCESS_TOKEN=sbp_…");
  console.log("  3. Re-run: npm run supabase:mcp-reconnect\n");
  console.log("Option B — CLI login:");
  console.log("  npm run supabase:mcp-reconnect -- --login");
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");
  const openOnly = args.has("--open");
  const doLogin = args.has("--login");

  console.log("Supabase MCP reconnect\n");

  if (doLogin) {
    runSupabaseLogin();
    const synced = await syncCliTokenToEnvLocal();
    if (!synced) {
      console.error("Login succeeded but no ~/.supabase/access-token found.");
      process.exit(1);
    }
    console.log("Synced CLI token into .env.local (SUPABASE_ACCESS_TOKEN).");
  }

  if (openOnly && !doLogin) {
    openUrl(TOKEN_URL);
    console.log(`Opened ${TOKEN_URL}`);
    printMissingTokenHelp();
    return;
  }

  let token = await readAccessToken();
  if (!token && doLogin) {
    token = await readAccessToken();
  }

  if (!token) {
    printMissingTokenHelp();
    openUrl(TOKEN_URL);
    process.exit(1);
  }

  console.log("Access token: found");
  const valid = await verifyToken(token);
  console.log(valid ? "Management API: OK" : "Management API: FAILED (token expired?)");

  if (!valid) {
    openUrl(TOKEN_URL);
    process.exit(1);
  }

  if (checkOnly) {
    console.log("\nToken is valid. Run without --check to write .cursor/mcp.json.");
    return;
  }

  await writeProjectMcpConfig(token);
  printReconnectSteps(true);

  if (platform() === "darwin") {
    try {
      execSync("open -a Cursor .", { cwd: process.cwd(), stdio: "ignore" });
    } catch {
      // Cursor not installed at default path
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
