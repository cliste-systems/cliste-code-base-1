#!/usr/bin/env node
/**
 * Fresha availability network discovery — headed Playwright session.
 * Captures internal JSON API calls while navigating the public booking flow.
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { driveFreshaBookingFlow } from './lib/fresha-flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURED_DIR = path.join(__dirname, 'captured');

const DEFAULT_URL =
  'https://www.fresha.com/a/the-south-east-hand-foot-spa-sligo-sligo-wine-street-xue0ij8i';

const INTERESTING =
  /(availab|timeslot|time-slot|slots|schedule|offer|booking|appointment|calendar|venue|service|catalog|location|employee)/i;

const TIME_LIKE =
  /(?:\b([01]?\d|2[0-3]):[0-5]\d\b|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

function parseArgs() {
  const config = {
    url: process.env.FRESHA_URL || DEFAULT_URL,
    service: 'Mini Manicure',
    minutes: 5,
    targetDay: 22,
    dateIso: null,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--url=')) config.url = arg.slice(6);
    else if (arg.startsWith('--service=')) {
      config.service = arg.slice(10).replace(/^["']|["']$/g, '');
    } else if (arg.startsWith('--minutes=')) {
      config.minutes = Number.parseFloat(arg.slice(10)) || 5;
    } else if (arg.startsWith('--day=')) {
      config.targetDay = Number.parseInt(arg.slice(6), 10) || 22;
    } else if (arg.startsWith('--date=')) {
      config.dateIso = arg.slice(7);
    }
  }

  if (!config.dateIso) {
    // Default probe date: 2026-06-{targetDay} (spike test window)
    const day = String(config.targetDay).padStart(2, '0');
    config.dateIso = `2026-06-${day}`;
  }

  return config;
}

function stripSensitiveHeaders(headers) {
  const safe = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'cookie' || lower === 'authorization') continue;
    safe[key] = value;
  }
  return safe;
}

function sanitizeFilenamePart(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getTopLevelKeys(body) {
  if (body == null) return [];
  if (Array.isArray(body)) return [`[array]`, `length=${body.length}`];
  if (typeof body === 'object') return Object.keys(body);
  return [typeof body];
}

function bodyHasTimeLikeValues(value) {
  try {
    return TIME_LIKE.test(JSON.stringify(value));
  } catch {
    return false;
  }
}

function urlTemplate(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      parsed.searchParams.set(key, `{${key}}`);
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}


async function parseResponseBody(response) {
  const contentType = response.headers()['content-type'] || '';

  try {
    if (contentType.includes('json')) {
      return { responseBody: await response.json(), responseBodyRaw: null };
    }
  } catch {
    // fall through to text
  }

  try {
    const text = await response.text();
    try {
      return { responseBody: JSON.parse(text), responseBodyRaw: null };
    } catch {
      return { responseBody: null, responseBodyRaw: text };
    }
  } catch (err) {
    return {
      responseBody: null,
      responseBodyRaw: `(failed to read body: ${err.message})`,
    };
  }
}

const captured = [];
const seenCaptureKeys = new Set();
let browser = null;
let shuttingDown = false;

async function writeCapture(record) {
  const dedupeKey = `${record.method}|${record.url}|${record.responseStatus}|${record.requestPostData ?? ''}`;
  if (seenCaptureKeys.has(dedupeKey)) return;
  seenCaptureKeys.add(dedupeKey);

  captured.push(record);

  await fs.mkdir(CAPTURED_DIR, { recursive: true });
  const filename = `${record.timestamp}-${record.method}-${sanitizeFilenamePart(record.url)}.json`;
  const filepath = path.join(CAPTURED_DIR, filename);
  record.filepath = filepath;

  await fs.writeFile(filepath, JSON.stringify(record, null, 2));
  console.log(`${record.method} ${record.responseStatus} ${record.url}`);
}

async function captureFromResponse(response) {
  const url = response.url();
  if (!INTERESTING.test(url) && !url.includes('graphql')) return;

  const request = response.request();
  const { responseBody, responseBodyRaw } = await parseResponseBody(response);

  const record = {
    timestamp: timestampForFile(),
    method: request.method(),
    url,
    requestHeaders: stripSensitiveHeaders(request.headers()),
    requestPostData: request.postData() ?? null,
    responseStatus: response.status(),
    responseContentType: response.headers()['content-type'] || '',
    responseBody,
    ...(responseBodyRaw != null ? { responseBodyRaw } : {}),
  };

  await writeCapture(record);
}

async function captureFromRequest(request) {
  const url = request.url();
  if (!INTERESTING.test(url)) return;

  const postData = request.postData();
  const postLooksJson =
    postData &&
    (postData.trim().startsWith('{') || postData.trim().startsWith('['));

  if (!postLooksJson && request.method() === 'GET') return;

  const record = {
    timestamp: timestampForFile(),
    method: request.method(),
    url,
    requestHeaders: stripSensitiveHeaders(request.headers()),
    requestPostData: postData ?? null,
    responseStatus: null,
    responseContentType: null,
    responseBody: null,
    note: 'request-only snapshot (response may arrive separately)',
  };

  if (postLooksJson) {
    try {
      record.requestPostDataParsed = JSON.parse(postData);
    } catch {
      // keep raw string only
    }
  }

  const dedupeKey = `req|${record.method}|${record.url}|${record.requestPostData ?? ''}`;
  if (seenCaptureKeys.has(dedupeKey)) return;
  seenCaptureKeys.add(dedupeKey);

  captured.push(record);
  await fs.mkdir(CAPTURED_DIR, { recursive: true });
  const filename = `${record.timestamp}-${record.method}-req-${sanitizeFilenamePart(record.url)}.json`;
  const filepath = path.join(CAPTURED_DIR, filename);
  record.filepath = filepath;
  await fs.writeFile(filepath, JSON.stringify(record, null, 2));
  console.log(`${record.method} (pending) ${record.url}`);
}

async function flushAndSummary() {
  console.log('\n=== SUMMARY ===');
  console.log(`Captured ${captured.length} relevant call(s).`);

  const withBodies = captured.filter(
    (c) => c.responseBody != null && bodyHasTimeLikeValues(c.responseBody),
  );

  console.log('\nMOST LIKELY AVAILABILITY ENDPOINT(S):');
  if (withBodies.length === 0) {
    console.log(
      '  (none with time-like JSON values — inspect spikes/fresha-availability/captured/ manually)',
    );
    return;
  }

  const printed = new Set();
  for (const call of withBodies) {
    const template = urlTemplate(call.url);
    const key = `${call.method} ${template}`;
    if (printed.has(key)) continue;
    printed.add(key);

    console.log(`  ${call.method} ${template}`);
    console.log(`    status: ${call.responseStatus}`);
    console.log(`    top-level keys: ${getTopLevelKeys(call.responseBody).join(', ')}`);
    if (call.filepath) console.log(`    file: ${path.basename(call.filepath)}`);
  }
}

async function autoDrive(page, config) {
  await driveFreshaBookingFlow(page, {
    service: config.service,
    dateIso: config.dateIso,
    log: (msg) => console.log(`Auto-drive: ${msg}`),
  });
}

async function main() {
  const config = parseArgs();

  console.log('Fresha availability sniff');
  console.log(`URL: ${config.url}`);
  console.log(`Service: ${config.service}`);
  console.log(`Target date: ${config.dateIso}`);
  console.log(`Capture window: ${config.minutes} minute(s)`);

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nShutting down — flushing captures…');
    await flushAndSummary();
    if (browser) await browser.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'en-IE',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('request', (request) => {
    captureFromRequest(request).catch((err) =>
      console.warn('request capture error:', err.message),
    );
  });

  page.on('response', (response) => {
    captureFromResponse(response).catch((err) =>
      console.warn('response capture error:', err.message),
    );
  });

  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  console.log('Page loaded. Attempting auto-drive…');

  try {
    await autoDrive(page, config);
  } catch (err) {
    console.log('Auto-drive error (continuing):', err.message);
  }

  console.log(
    `\nWatching network for ${config.minutes} minute(s). Finish the click-through manually if needed.`,
  );
  console.log('Press Ctrl+C to stop early.\n');

  await page.waitForTimeout(config.minutes * 60 * 1000);

  await flushAndSummary();
  await browser.close();
}

main().catch(async (err) => {
  console.error(err);
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
