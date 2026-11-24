import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const destination = process.env.ONHARU_URL || 'http://127.0.0.1:8080/legacy/';
const output = 'test-results/guided-tour';
await fs.mkdir(output, { recursive: true });

try {
  for (const [width, lang, colorScheme] of [
    [320, 'ko', 'light'], [390, 'ko', 'dark'], [1024, 'en', 'light'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: lang === 'ko' ? 'ko-KR' : 'en-US',
      timezoneId: 'Pacific/Honolulu',
      serviceWorkers: 'block',
      isMobile: width < 500,
      hasTouch: width < 500,
      colorScheme,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(12000);
    try {
      await page.route('**/legacy/nlt?*', route => route.fulfill({
        contentType: 'text/html',
        body: '<p>Sample passage for a local test.</p>',
      }));
      await page.goto(destination);
      await page.locator(lang === 'ko' ? '#tutorialChooseKo' : '#tutorialChooseEn').click();
      await page.locator('#startGuidedTour').click();
      const next = page.locator('#tourNext');
      const entry = page.locator('#page-checkin #morningPrayerPrompt button');
      await entry.waitFor();
      assert.equal(await page.locator('#focusStart').isVisible(), false);
      assert.equal(await entry.evaluate(button => button.classList.contains('guided-target')), true);
      await page.screenshot({ path: output + '/' + width + '-morning-checkin.png' });
      await entry.click();
      await page.locator('#focusDurations [data-time="2"]').click();
      await page.locator('#focusStart').click();
      await page.locator('#focusEnd').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem(ACTIVE_SESSION_KEY)), null);
      await page.screenshot({ path: output + '/' + width + '-prayer.png' });
      await page.waitForTimeout(1150);
      await page.locator('#focusEnd').click();
      await page.locator('#choiceModal').waitFor();
      assert.match(await page.locator('#choiceTitle').innerText(), lang === 'ko' ? /아침기도/ : /Morning prayer/);
      await page.screenshot({ path: output + '/' + width + '-prayer-complete.png' });
      await page.locator('#choiceList .morning-prayer-primary').click();
      const anchor = lang === 'ko' ? '지금 할 수 있는 것 하나만.' : 'One thing I can do right now.';
      assert.equal(await page.locator('#dayHeadline').inputValue(), '');
      await page.locator('#dayHeadline').fill(anchor);
      assert.equal(await page.evaluate(() => day(date).headline), anchor);
      await page.screenshot({ path: output + '/' + width + '-anchor.png' });
      await page.locator('#morningPrayerReadAfterAnchor').click();
      await page.locator('#sm-overlay .sm-verse').waitFor();
      await page.locator('#sm-content .sm-primary').click();
      await page.locator('#qc-text').fill('Practice scripture reflection');
      await page.locator('#qc-submit').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('kona.scripture-memory.v1')), null);
      await next.click();
      await page.getByRole('slider', { name: lang === 'ko' ? '기분' : 'Mood', exact: true }).press('ArrowRight');
      await next.click();
      await page.locator('#pinRow .task-overview-actions button:first-child').click();
      assert.equal(await page.locator('#guidedTour').isVisible(), false);
      assert.match(await page.locator('#taskTitle').inputValue(), lang === 'ko' ? /걷기/ : /Walk/);
      await page.screenshot({ path: output + '/' + width + '-plan.png' });
      await page.locator('#taskSave').click();
      assert.equal(await page.evaluate(() => db.tasks.length), 1);
      await next.click();
      await page.locator('#qc-v2 [data-tag="meaning_listening"]').click();
      await page.locator('#qc-submit').click();
      assert(await page.evaluate(() => day(date).quickCaptureEntries.some(
        note => note.time === '12:40' && note.tags.includes('meaning_listening'),
      )));
      await next.click();
      await page.locator('#focusLibraryOpen').click();
      await page.locator('.prayer-row-main').first().click();
      assert(await page.locator('.prayer-record-text').count() >= 2);
      await next.click();
      await page.locator('.rv-timeline img.kona-sheep-icon').first().waitFor();
      assert.equal(await page.locator('.rv-anchor-text').first().innerText(), anchor);
      await page.screenshot({ path: output + '/' + width + '-review.png' });
      await next.click();
      await next.click();
      assert.equal(await page.locator('#guidedTour').isVisible(), false);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some(
        key => /tour-appointment|tour-prayer-session|Practice scripture reflection|지금 할 수 있는 것 하나만\.|One thing I can do right now\./.test(String(localStorage.getItem(key))),
      )), false);
      assert.deepEqual(errors, []);
      console.log('PASS', width, lang, colorScheme);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
