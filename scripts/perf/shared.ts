import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: ".env.local" });

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(scriptDir, "../..");
export const PERF_DIR = join(REPO_ROOT, ".perf");
export const PERF_RESULTS_DIR = join(REPO_ROOT, "perf-results");
export const AUTH_STATE_PATH = join(PERF_DIR, "auth-state.json");
export const CREDENTIALS_PATH = join(PERF_DIR, "credentials.json");

export const DEFAULT_BASE_URL =
  process.env.PERF_BASE_URL?.trim() || "http://localhost:3001";

export const RUNS_PER_ROUTE = Number(process.env.PERF_RUNS ?? "3") || 3;

export type PerfCredentials = {
  email: string;
  password: string;
};

export function ensurePerfDirs(): void {
  mkdirSync(PERF_DIR, { recursive: true });
  mkdirSync(PERF_RESULTS_DIR, { recursive: true });
}

export function loadCredentials(): PerfCredentials {
  const email = process.env.PERF_TEST_EMAIL?.trim();
  const password = process.env.PERF_TEST_PASSWORD?.trim();
  if (email && password) {
    return { email, password };
  }

  if (existsSync(CREDENTIALS_PATH)) {
    const raw = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as PerfCredentials;
    if (raw.email && raw.password) {
      return raw;
    }
  }

  throw new Error(
    "Missing perf credentials. Run `npm run perf:seed` or set PERF_TEST_EMAIL and PERF_TEST_PASSWORD.",
  );
}

export function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function roundMs(value: number): number {
  return Math.round(value);
}

export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
