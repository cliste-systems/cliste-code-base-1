/**
 * Shared Playwright helpers for Fresha's public booking SPA.
 * Lessons baked in from Sligo test salon (Jun 2026):
 *   - Dismiss cookie/privacy banner before clicking (blocks pointer events)
 *   - Click Book on the service row, not the sidebar "Book now"
 *   - Date picker is a horizontal strip: "Tue 23 Jun", not a calendar grid "23"
 *   - Availability arrives via GraphQL bookingFlowActionButtonPressed → screenTime.day.timeslots
 */

/** @param {string} text */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {import('playwright').Page} page
 */
export async function dismissFreshaBanners(page) {
  for (const label of [/accept/i, /reject non-essential/i, /close/i, /got it/i]) {
    try {
      await page.getByRole('button', { name: label }).first().click({ timeout: 2000 });
      await page.waitForTimeout(400);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [categoryTab] e.g. "Gentlemen" — some services are not on the default tab
 */
export async function selectServiceCategoryTab(page, categoryTab) {
  if (!categoryTab) return false;
  try {
    await page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(categoryTab)}$`, 'i') }).click({
      timeout: 5000,
    });
    await page.waitForTimeout(600);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} serviceName
 */
export async function clickServiceBook(page, serviceName) {
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(400);

  const serviceRow = page.locator('div, li, article, section').filter({
    hasText: new RegExp(`^${escapeRegExp(serviceName)}`, 'i'),
  });
  const bookBtn = serviceRow.first().getByRole('button', { name: /^book$/i });
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click({ timeout: 12_000, force: true });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} serviceName
 */
export async function clickServiceBookFallback(page, serviceName) {
  await page
    .locator(`text=${serviceName}`)
    .first()
    .locator('xpath=following::button[contains(normalize-space(.),"Book")][1]')
    .click({ timeout: 8000, force: true });
}

/**
 * @param {import('playwright').Page} page
 */
export async function clickContinue(page) {
  await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 8000 });
}

/**
 * @param {import('playwright').Page} page
 */
export async function clickAnyProfessional(page) {
  await page.getByText(/any professional/i).first().click({ timeout: 8000 });
}

/**
 * Build date-picker patterns for Fresha's horizontal strip (e.g. "Tue 23 Jun").
 * @param {string} dateIso YYYY-MM-DD
 */
export function datePickerPatterns(dateIso) {
  const d = new Date(`${dateIso}T12:00:00`);
  const dayNum = d.getUTCDate();
  const weekdayShort = d.toLocaleDateString('en-IE', { weekday: 'short', timeZone: 'UTC' });
  const weekdayLong = d.toLocaleDateString('en-IE', { weekday: 'long', timeZone: 'UTC' });
  const monthShort = d.toLocaleDateString('en-IE', { month: 'short', timeZone: 'UTC' });

  return [
    new RegExp(`${weekdayShort}.*${dayNum}.*${monthShort}`, 'i'),
    new RegExp(`${weekdayLong}.*${dayNum}`, 'i'),
    new RegExp(`${dayNum} ${monthShort}`, 'i'),
    new RegExp(`^${dayNum}$`),
  ];
}

/**
 * @param {import('playwright').Page} page
 * @param {string} dateIso YYYY-MM-DD
 */
export async function selectFreshaDate(page, dateIso) {
  const patterns = datePickerPatterns(dateIso);
  const dayNum = String(new Date(`${dateIso}T12:00:00`).getUTCDate());

  for (const pattern of patterns) {
    try {
      await page.getByRole('button', { name: pattern }).first().click({ timeout: 4000 });
      return true;
    } catch {
      try {
        await page.getByText(pattern).first().click({ timeout: 3000 });
        return true;
      } catch {
        // next
      }
    }
  }

  for (let i = 0; i < 6; i++) {
    try {
      await page
        .getByRole('button', { name: new RegExp(`^${dayNum}$`) })
        .first()
        .click({ timeout: 3000 });
      return true;
    } catch {
      try {
        await page.locator('[aria-label*="next" i]').last().click({ timeout: 2000 });
        await page.waitForTimeout(600);
      } catch {
        break;
      }
    }
  }

  return false;
}

/**
 * Drive Book → service → Continue → Any professional → date.
 * @param {import('playwright').Page} page
 * @param {{ service: string, dateIso: string, categoryTab?: string, log?: (msg: string) => void }} opts
 */
export async function driveFreshaBookingFlow(page, opts) {
  const log = opts.log ?? (() => {});
  const pause = (ms) => page.waitForTimeout(ms);

  if (await dismissFreshaBanners(page)) log('✓ Dismissed cookie/privacy banner');

  if (opts.categoryTab) {
    if (await selectServiceCategoryTab(page, opts.categoryTab)) {
      log(`✓ Category tab "${opts.categoryTab}"`);
    } else {
      log(`✗ Category tab "${opts.categoryTab}"`);
    }
  }

  try {
    await clickServiceBook(page, opts.service);
    log(`✓ Book on "${opts.service}"`);
  } catch {
    try {
      await clickServiceBookFallback(page, opts.service);
      log(`✓ Book on "${opts.service}" (fallback)`);
    } catch (err) {
      log(`✗ Book on "${opts.service}": ${err.message}`);
      return false;
    }
  }

  await pause(2500);

  try {
    await clickContinue(page);
    log('✓ Continue');
  } catch {
    log('✗ Continue');
  }

  await pause(2000);

  try {
    await clickAnyProfessional(page);
    log('✓ Any professional');
  } catch {
    log('✗ Any professional');
  }

  await pause(2500);

  if (await selectFreshaDate(page, opts.dateIso)) {
    log(`✓ Date ${opts.dateIso}`);
  } else {
    log(`✗ Date ${opts.dateIso}`);
  }

  await pause(5000);
  return true;
}

/**
 * @param {import('playwright').Page} page
 */
export async function readVisibleTimeButtons(page) {
  return page
    .locator('button')
    .filter({ hasText: /^\d{1,2}:\d{2}(\s?(AM|PM))?$/i })
    .allTextContents()
    .catch(() => []);
}
