#!/usr/bin/env node
/**
 * One-shot availability check for a Fresha public booking page.
 *
 *   node check-slots.mjs --service="Mini Manicure" --date=2026-06-23
 *   node check-slots.mjs --url=... --service="Mini Manicure" --date=2026-06-23 --at=10:55
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { driveFreshaBookingFlow, readVisibleTimeButtons } from './lib/fresha-flow.mjs';
import {
  normalizeToShadowSlots,
  findSlotNearTime,
  isDayFullyBooked,
} from './lib/fresha-slots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL =
  'https://www.fresha.com/a/the-south-east-hand-foot-spa-sligo-sligo-wine-street-xue0ij8i';

function parseArgs() {
  /** @type {{ url: string, service: string, date: string, at: string|null, duration: number, orgRef: string, tab: string|null }} */
  const config = {
    url: process.env.FRESHA_URL || DEFAULT_URL,
    service: 'Mini Manicure',
    date: '2026-06-23',
    at: null,
    duration: 35,
    orgRef: 'the-south-east-hand-foot-spa-sligo',
    tab: null,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--url=')) config.url = arg.slice(6);
    else if (arg.startsWith('--service=')) {
      config.service = arg.slice(10).replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--date=')) config.date = arg.slice(7);
    else if (arg.startsWith('--at=')) config.at = arg.slice(5);
    else if (arg.startsWith('--duration=')) {
      config.duration = Number.parseInt(arg.slice(11), 10) || 35;
    } else if (arg.startsWith('--org=')) config.orgRef = arg.slice(6);
    else if (arg.startsWith('--tab=')) config.tab = arg.slice(6).replace(/^["']|["']$/g, '');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.date)) {
    console.error('--date must be YYYY-MM-DD');
    process.exit(1);
  }

  return config;
}

function slugFromFreshaUrl(url) {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop();
    return slug?.replace(/-xue0ij8i$/, '') ?? 'fresha-org';
  } catch {
    return 'fresha-org';
  }
}

async function main() {
  const config = parseArgs();
  if (config.orgRef === 'the-south-east-hand-foot-spa-sligo' && config.url !== DEFAULT_URL) {
    config.orgRef = slugFromFreshaUrl(config.url);
  }

  const weekday = new Date(`${config.date}T12:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'long',
    timeZone: 'UTC',
  });

  console.log('Fresha availability check');
  console.log(`  URL:     ${config.url}`);
  console.log(`  Service: ${config.service} (${config.duration} min)`);
  console.log(`  Date:    ${config.date} (${weekday})`);
  if (config.at) console.log(`  Check:   ~${config.at}`);
  console.log('');

  /** @type {Array<{ url: string, status: number, method: string, body: unknown }>} */
  const captures = [];

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'en-IE',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('graphql')) return;
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const body = await response.json();
      const text = JSON.stringify(body);
      if (/timeslot|bookingFlow|screenTime|availability/i.test(text)) {
        captures.push({
          url,
          status: response.status(),
          method: response.request().method(),
          body,
        });
      }
    } catch {
      // ignore
    }
  });

  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(2000);

  await driveFreshaBookingFlow(page, {
    service: config.service,
    dateIso: config.date,
    categoryTab: config.tab ?? undefined,
    log: (msg) => console.log(msg),
  });

  const visible = (await readVisibleTimeButtons(page)).map((t) => t.trim()).filter(Boolean);
  const pageText = await page.locator('body').innerText().catch(() => '');
  const fullyBooked = /fully booked|no available times/i.test(pageText);

  const outFile = path.join(__dirname, 'captured', `check-${config.date}.json`);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        config,
        captures,
      },
      null,
      2,
    ),
  );

  const screenshot = path.join(__dirname, 'captured', `check-${config.date}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await browser.close();

  const slots = normalizeToShadowSlots(captures, {
    orgRef: config.orgRef,
    serviceName: config.service,
    serviceDurationMinutes: config.duration,
    filterDate: config.date,
    capturedAt: new Date().toISOString(),
  });

  console.log('\n=== RESULT ===');
  console.log(`Capture: ${outFile}`);
  console.log(`Screenshot: ${screenshot}`);

  if (slots.length === 0) {
    if (fullyBooked || isDayFullyBooked(captures)) {
      console.log(`\nNo slots — ${weekday} ${config.date} appears fully booked for ${config.service}.`);
    } else {
      console.log('\nNo slots parsed — flow may have failed or Fresha changed their UI.');
    }
    process.exit(1);
  }

  console.log(`\n${slots.length} slot(s) for ${config.service} on ${config.date}:`);
  for (const s of slots) {
    console.log(`  ${s.label ?? s.startIso}`);
  }

  if (config.at) {
    const match = findSlotNearTime(slots, config.at);
    if (match) {
      console.log(`\n✓ ~${config.at} is bookable (${match.label ?? match.startIso}).`);
    } else {
      console.log(`\n✗ ~${config.at} not found in available slots.`);
    }
  }

  console.log('\n→ Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
