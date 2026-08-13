#!/usr/bin/env node
/**
 * Replay / normalize a captured Fresha availability response.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeToShadowSlots,
  extractFreshaTimeslots,
  findSlotNearTime,
} from './lib/fresha-slots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const fromArg = process.argv.find((a) => a.startsWith('--from='));
  const atArg = process.argv.find((a) => a.startsWith('--at='));
  if (!fromArg) {
    console.error('Usage: node replay.mjs --from=captured/<file>.json [--at=10:55]');
    process.exit(1);
  }
  const relative = fromArg.slice(7);
  return {
    filepath: path.isAbsolute(relative) ? relative : path.join(__dirname, relative),
    at: atArg ? atArg.slice(5) : null,
  };
}

async function main() {
  const { filepath, at } = parseArgs();
  const text = await fs.readFile(filepath, 'utf8');
  const captured = JSON.parse(text);

  const roots = Array.isArray(captured)
    ? captured
    : captured.captures ?? [captured];

  const rawBodies = roots.map((c) => c.body ?? c.responseBody).filter(Boolean);
  const config = captured.config ?? {};

  console.log('=== Captured file ===');
  console.log(`File: ${path.basename(filepath)}`);
  if (config.service) console.log(`Service: ${config.service}`);
  if (config.date) console.log(`Date: ${config.date}`);

  const sample = rawBodies[0];
  console.log('\n=== Inferred shape ===');
  console.log('Top-level keys:', sample ? Object.keys(sample).join(', ') : '(none)');

  const slotsRaw = rawBodies.flatMap((b) => extractFreshaTimeslots(b));
  console.log(`Timeslots found in GraphQL: ${slotsRaw.length}`);
  if (slotsRaw[0]) {
    console.log('Sample slot keys:', Object.keys(slotsRaw[0]).join(', '));
    console.log('Sample label:', slotsRaw[0].time);
  }

  const normalized = normalizeToShadowSlots(captured.captures ?? captured, {
    capturedAt: captured.checkedAt ?? captured.timestamp,
    serviceName: config.service ?? 'Mini Manicure',
    serviceDurationMinutes: config.duration ?? 35,
    orgRef: config.orgRef ?? 'the-south-east-hand-foot-spa-sligo',
    filterDate: config.date,
  });

  console.log('\n=== Normalized shadow slots ===');
  console.log(JSON.stringify(normalized.slice(0, 5), null, 2));
  if (normalized.length > 5) {
    console.log(`… and ${normalized.length - 5} more`);
  }

  if (at) {
    const match = findSlotNearTime(normalized, at);
    console.log(
      match
        ? `\n✓ ~${at} is bookable (${match.label ?? match.startIso}).`
        : `\n✗ ~${at} not in normalized slots.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
