import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const output = 'test-results/morning-prayer-onboarding';
await mkdir(output, {recursive: true});

try {
  for (const [width, theme, lang] of [[320, 'light', 'ko'], [390, 'dark', 'ko'], [1024, 'light', 'en']]) {
    const context = await browser.newContext({
      viewport: {width, height: 840},
      isMobile: width < 600,
      hasTouch: width < 600,
      locale: lang === 'ko' ? 'ko-KR' : 'en-US',
      timezoneId: 'Pacific/Honolulu',
      colorScheme: theme,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/legacy/nlt?*', route => route.fulfill({
        contentType: 'text/html',
        body: '<p>Test passage supplied by the local relay fixture.</p>',
      }));
      await page.goto(process.env.ONHARU_URL || 'http://127.0.0.1:8080/legacy/');
      const choose = page.locator(lang === 'ko' ? '#tutorialChooseKo' : '#tutorialChooseEn');
      await choose.click();
      const welcome = page.locator('#tutorialWelcome');
      const shortcut = page.locator('#startMorningPrayerGuide');
      await welcome.waitFor();
      await page.locator('#launchScreen').waitFor({state: 'hidden'});
      assert.equal(await shortcut.count(), 0);
      await page.screenshot({path: output + '/' + width + '-welcome.png'});
      await page.locator('#welcomeSkip').click();

      await page.locator('#openAppHelp').evaluate(button => button.click());
      await page.locator('#revisitWelcome').click();
      await welcome.waitFor();
      assert.equal(await shortcut.count(), 0);
      await page.locator('#welcomeSkip').click();

      const checkin = page.locator('.tabs [data-page="checkin"]');
      await checkin.click();
      await page.locator('#page-checkin [data-phase="morning"]').click();
      await page.locator('#morningPrayerPrompt button').click();
      await page.locator('#morningPrayerDurationHeading').waitFor();
      assert.equal(await page.locator('#focusTarget').isVisible(), false);

      const timer = page.locator('#focusStart');
      const finish = page.locator('#focusEnd');
      const completion = page.locator('#choiceModal');
      const note = lang === 'ko' ? '기도하며 먼저 듣기로 했다.' : 'I thought about listening first.';
      await timer.click();
      await page.locator('#focusNoteToggle').click();
      await page.locator('#timerNote').fill(note);
      await page.waitForTimeout(1150);
      await finish.click();
      await completion.waitFor();
      assert.equal(await completion.locator('.choice').count(), 3);
      const title = await page.locator('#choiceTitle').innerText();
      assert.match(title, lang === 'ko' ? /아침기도를 마쳤어요/ : /Morning prayer is complete/);
      assert.equal(await completion.locator('.close').isVisible(), true);
      await page.screenshot({path: output + '/' + width + '-completion.png'});
      await completion.locator('.choice').nth(2).click();
      assert.equal(await page.locator('#sessionMemo').inputValue(), note);
      await page.locator('#sessionNoteModal .close').click();

      async function finishMorningPrayer() {
        await checkin.click();
        await page.locator('#page-checkin [data-phase="morning"]').click();
        await page.locator('#morningPrayerPrompt button').click();
        await timer.click();
        await page.waitForTimeout(1150);
        await finish.click();
        await completion.waitFor();
      }

      await finishMorningPrayer();
      assert.equal(await completion.locator('.choice').count(), 2);
      await completion.locator('.choice').first().click();
      const anchor = page.locator('#dayHeadline');
      const line = lang === 'ko' ? '먼저 듣기' : 'Listen first';
      await anchor.fill(line);
      await page.locator('#morningPrayerReadAfterAnchor').click();
      const overlay = page.locator('#sm-overlay');
      const reference = overlay.locator('.sm-reference').first();
      await reference.waitFor();
      const first = await reference.innerText();
      await overlay.locator('.sm-verse').waitFor();
      assert.match(await overlay.innerText(), lang === 'ko' ? /마음에 남은 게/ : /What stayed with you/);
      await page.screenshot({path: output + '/' + width + '-scripture.png'});
      await overlay.locator('.sm-primary').click();
      assert.equal(await anchor.inputValue(), line);
      assert.equal(await page.locator('#qc-note-title').inputValue(), first.split(' · ')[0]);
      await page.locator('#qc-text').fill(note);
      await page.locator('#qc-submit').click();

      await page.reload();
      assert.equal(await anchor.inputValue(), line);
      await page.locator('#sm-write-cue').click();
      assert.equal(await reference.innerText(), first);
      await overlay.locator('.sm-back').click();
      await finishMorningPrayer();
      await completion.locator('.choice').nth(1).click();
      assert.equal(await reference.innerText(), first);
      await overlay.locator('.sm-back').click();

      await finishMorningPrayer();
      await completion.locator('.close').click();
      assert.equal(await overlay.isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      console.log('PASS', width, theme, lang);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
