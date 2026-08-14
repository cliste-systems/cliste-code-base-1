/**
 * Guards for scripts that mutate or delete production data.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export function resolveSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0]?.trim();
    return ref || null;
  } catch {
    return null;
  }
}

export function isProductionSupabaseRef(ref: string): boolean {
  const productionRef =
    process.env.CLISTE_PRODUCTION_SUPABASE_REF?.trim() ||
    "rtoebbwzwxcnscsxghww";
  return ref === productionRef;
}

export async function requireDestructiveScriptConfirmation(options: {
  actionLabel: string;
  requireYesFlag?: boolean;
}): Promise<void> {
  const ref = resolveSupabaseProjectRef();
  if (!ref) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local — cannot confirm target project.",
    );
  }

  if (options.requireYesFlag !== false) {
    const hasFlag = process.argv.includes("--yes-i-am-sure");
    if (!hasFlag) {
      throw new Error(
        `Refusing ${options.actionLabel}. Re-run with --yes-i-am-sure after confirming the target project.`,
      );
    }
  }

  if (
    isProductionSupabaseRef(ref) &&
    process.env.CLISTE_ALLOW_DESTRUCTIVE_ON_PROD !== "1"
  ) {
    throw new Error(
      `Refusing ${options.actionLabel} on production Supabase project ${ref}. ` +
        "Set CLISTE_ALLOW_DESTRUCTIVE_ON_PROD=1 only if you are certain.",
    );
  }

  console.warn(
    `\n⚠️  About to ${options.actionLabel} in Supabase project: ${ref}\n`,
  );

  const rl = createInterface({ input, output });
  try {
    const typed = (
      await rl.question(`Type the project ref to continue: `)
    ).trim();
    if (typed !== ref) {
      throw new Error("Confirmation failed — project ref did not match.");
    }
  } finally {
    rl.close();
  }
}
