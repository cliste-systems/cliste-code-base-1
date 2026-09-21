import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dashboardRepo = process.cwd();
const workerRepo = resolve(dashboardRepo, "../cliste-code-base-2");
const repos = [
  { name: "dashboard", dir: dashboardRepo },
  { name: "worker", dir: workerRepo },
];

function run(dir, args, options = {}) {
  return spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function branchName(dir) {
  return run(dir, ["branch", "--show-current"]).stdout.trim();
}

function isClean(dir) {
  return run(dir, ["status", "--porcelain"]).stdout.trim().length === 0;
}

function syncRepo(repo) {
  if (!existsSync(repo.dir)) {
    console.error(`[local-sync] Missing ${repo.name} repo at ${repo.dir}`);
    return;
  }

  const branch = branchName(repo.dir);
  if (branch !== "local-dev") {
    console.error(
      `[local-sync] ${repo.name} is on "${branch || "detached"}", not "local-dev". Skipping auto-sync.`,
    );
    return;
  }

  if (!isClean(repo.dir)) {
    console.warn(
      `[local-sync] ${repo.name} has local changes; skipping pull so nothing gets overwritten.`,
    );
    return;
  }

  const fetch = run(repo.dir, ["fetch", "origin", "local-dev"]);
  if (fetch.status !== 0) {
    console.error(`[local-sync] ${repo.name} fetch failed: ${fetch.stderr.trim()}`);
    return;
  }

  const local = run(repo.dir, ["rev-parse", "HEAD"]).stdout.trim();
  const remote = run(repo.dir, ["rev-parse", "origin/local-dev"]).stdout.trim();
  if (!local || !remote || local === remote) return;

  const merge = run(repo.dir, ["merge", "--ff-only", "origin/local-dev"]);
  if (merge.status === 0) {
    console.log(`[local-sync] Updated ${repo.name} to ${remote.slice(0, 8)}`);
  } else {
    console.error(
      `[local-sync] ${repo.name} could not fast-forward: ${merge.stderr.trim()}`,
    );
  }
}

for (const repo of repos) syncRepo(repo);

const child = spawn("npm", ["run", "dev:text-rehearsal"], {
  cwd: dashboardRepo,
  stdio: "inherit",
  env: process.env,
});

const timer = setInterval(() => {
  for (const repo of repos) syncRepo(repo);
}, 5000);

function shutdown(signal) {
  clearInterval(timer);
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  clearInterval(timer);
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
