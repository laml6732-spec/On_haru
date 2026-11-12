// Preview-only browser QA for typography, using synthetic DOM data and isolated profiles.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const artifactDir = 'test-results/typography-preview';
await fs.mkdir(artifactDir, { recursive: true });
const executablePath = [process.env.CHROME_PATH, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/google-chrome'].find(x => x && existsSync(x));
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = [];
let failureCount = 0;

function test(row, name, passed, details) {
  row.tests.push({ name, passed: Boolean(passed), details });
  if (!passed) { failureCount++; console.error('TYPOGRAPHY_FAIL', row.key, name, JSON.stringify(details)); }
}

for (const width of [320, 390, 1024]) {
  for (const theme of ['light', 'dark']) {
    const row = { key: width + '-' + theme, tests: [], errors: [] };
    report.push(row);
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600,
      serviceWorkers: 'block', locale: 'en-US', reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    page.on('pageerror', e => row.errors.push(String(e)));
    try {
      await page.goto('http://127.0.0.1:8080/legacy/', { waitUntil: 'domcontentloaded' });
      await page.locator('.tabs [data-page="capture"]').waitFor();
      const choose = page.locator('#tutorialChooseEn');
      if (await choose.isVisible()) await choose.click();
      const skip = page.locator('#welcomeSkip');
      if (await skip.isVisible()) await skip.click();
      await page.evaluate((theme) => {
        document.getElementById('launchScreen')?.remove();
        const tutorial = document.getElementById('tutorialModal');
        if (tutorial) { tutorial.hidden = true; tutorial.style.display = 'none'; }
        document.documentElement.dataset.appearance = theme;
        document.documentElement.style.colorScheme = theme;
      }, theme);
      await page.locator('.tabs [data-page="capture"]').click();
      await page.evaluate(() => {
        const anchor = document.getElementById('dayHeadline');
        if (anchor) anchor.value = 'This day is a gift to steward with care and grace.';
        const p = document.getElementById('konaPriorityTask');
        if (!p) return;
        p.hidden = false;
        p.innerHTML = '<div class="pinned-item"><button type="button" class="task-check" aria-label="Complete task"><img src="./assets/hibiscus-task-off.png" alt=""></button><button type="button" class="pinned-title important"><span class="task-name">An important task and meaningful next step for today</span></button></div>';
      });
      const metrics = await page.evaluate(() => {
        function m(sel) {
          const el = document.querySelector(sel);
          if (!el) return null;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return { font: parseFloat(s.fontSize), weight: s.fontWeight, lineHeight: parseFloat(s.lineHeight),
            width: Math.round(r.width), height: Math.round(r.height), color: s.color };
        }
        return {
          release: document.querySelector('meta[name="kona-release"]')?.content,
          stylesheet: !!document.querySelector('link[href*="typography-preview.v1.css"]'),
          anchorLabel: m('#konaCarryToday .carry-label'),
          anchorText: m('#dayHeadline'),
          priorityTitle: m('#konaPriorityTask .pinned-title .task-name'),
          flower: m('#konaPriorityTask .task-check img'),
          priorityRow: m('#konaPriorityTask'),
          overflow: document.documentElement.scrollWidth - innerWidth
        };
      });
      test(row, 'Preview stylesheet and release loaded', metrics.stylesheet && metrics.release === 'typographyreview20261112a', metrics);
      test(row, 'Anchor label 12px, body 16px / 24px', metrics.anchorLabel?.font === 12 && metrics.anchorText?.font === 16 && metrics.anchorText?.lineHeight === 24, metrics);
      test(row, 'Important title 14px / 21px and flower 18px', metrics.priorityTitle?.font === 14 && metrics.priorityTitle?.lineHeight === 21 && metrics.flower?.width === 18, metrics);
      test(row, 'No Capture horizontal overflow', metrics.overflow <= 2, metrics);
      const geometry = await page.evaluate(() => {
        const rect = (sel) => {
          const node = document.querySelector(sel);
          if (!node) return null;
          const r = node.getBoundingClientRect();
          return { left:r.left, right:r.right, top:r.top, bottom:r.bottom,
            xCenter:(r.left+r.right)/2, yCenter:(r.top+r.bottom)/2, width:r.width, height:r.height };
        };
        const anchor=rect('#konaCarryToday'), label=rect('#konaCarryToday .carry-label'),
          text=rect('#dayHeadline'), edit=rect('#konaCarryToday .carry-edit'),
          important=rect('#konaPriorityTask'),
          flower=rect('#konaPriorityTask .task-check img'),
          task=rect('#konaPriorityTask .pinned-title .task-name'), note=rect('#qc-v2');
        return {anchor,label,text,edit,important,flower,task,note,
          topGap: important?.top - anchor?.bottom,
          bottomGap: note?.top - important?.bottom,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth};
      });
      row.geometry = geometry;
      const near=(a,b,delta=2)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=delta;
      test(row, 'Anchor, priority row and memo align to shared outer edges',
        near(geometry.anchor?.left,geometry.important?.left,1)&&near(geometry.important?.left,geometry.note?.left,1)&&
        near(geometry.anchor?.right,geometry.important?.right,1)&&near(geometry.important?.right,geometry.note?.right,1),geometry);
      test(row, 'Anchor label and copy share a left origin',
        near(geometry.label?.left,geometry.text?.left,2),geometry);
      test(row, 'Flower visually starts near anchor copy and shares title center',
        near(geometry.flower?.left,geometry.label?.left,8)&&near(geometry.flower?.yCenter,geometry.task?.yCenter,4),geometry);
      test(row, 'Important highlight leaves right content padding',
        geometry.task?.right <= geometry.note?.right - 10,geometry);
      test(row, 'Anchor edit is vertically centered and ends at right inset',
        near(geometry.edit?.yCenter,geometry.anchor?.yCenter,6)&&geometry.edit?.right <= geometry.anchor?.right-8,geometry);
      test(row, 'Anchor-to-priority and priority-to-memo vertical gaps are balanced',
        geometry.topGap>=8 && geometry.bottomGap>=8 && near(geometry.topGap,geometry.bottomGap,4),geometry);
      await page.screenshot({ path: artifactDir + '/capture-' + row.key + '.png', animations: 'disabled', fullPage: true });

      // Plan tasks: synthetic row only, with no mutation of the application's saved notes.
      await page.locator('.tabs [data-page="today"]').click();
      const plan = await page.evaluate(() => {
        const c = document.getElementById('todayTaskCard');
        if (!c) return { missing: true };
        c.hidden = false;
        const list = c.querySelector('#todayTaskList');
        if (list) list.innerHTML = '<div class="quicktask"><button type="button" class="task-title"><span class="task-name">An ordinary task with a longer title</span></button></div>';
        const e = c.querySelector('.quicktask .task-name');
        const s = e && getComputedStyle(e);
        return { font: s ? parseFloat(s.fontSize) : null, weight: s?.fontWeight,
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      test(row, 'Plan task 14px and no horizontal overflow', plan.font === 14 && plan.overflow <= 2, plan);
      await page.screenshot({ path: artifactDir + '/plan-' + row.key + '.png', animations: 'disabled', fullPage: true });

      // 19px app reading setting: only the priority row may grow; it cannot clip.
      await page.locator('.tabs [data-page="capture"]').click();
      // Every tab navigation re-renders tasks; reinsert synthetic data for the enlarged-text check.
      await page.evaluate(() => {
        const p = document.getElementById('konaPriorityTask');
        if (!p) return;
        p.hidden = false;
        p.innerHTML = '<div class="pinned-item"><button type="button" class="task-check" aria-label="Complete task"><img src="./assets/hibiscus-task-off.png" alt=""></button><button type="button" class="pinned-title important"><span class="task-name">An important task and meaningful next step for today</span></button></div>';
      });
      const large = await page.evaluate(() => {
        document.documentElement.dataset.uiEnlarged = 'true';
        document.documentElement.style.setProperty('--kona-ui-scale', String(19 / 13.5));
        const el = document.querySelector('#konaPriorityTask .pinned-title .task-name');
        const row = document.getElementById('konaPriorityTask');
        const style = getComputedStyle(el);
        const box = row.getBoundingClientRect();
        return { font: parseFloat(style.fontSize), whiteSpace: style.whiteSpace, maxHeight: getComputedStyle(row).maxHeight,
          rowHeight: box.height, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      test(row, 'Enlarged important title scales and wraps without horizontal overflow',
        large.font > 19.6 && large.font < 19.9 && large.whiteSpace === 'normal' && large.overflow <= 2, large);
      await page.screenshot({ path: artifactDir + '/capture-enlarged-' + row.key + '.png', animations: 'disabled', fullPage: true });
      row.metrics = { capture: metrics, plan, enlarged: large };
    } catch (e) {
      row.errors.push(String(e));
      failureCount++;
      console.error('TYPOGRAPHY_ERROR', row.key, String(e));
    } finally { await context.close(); }
    console.log('TYPOGRAPHY_CASE', row.key, JSON.stringify({ pass: row.tests.filter(t => t.passed).length, fail: row.tests.filter(t => !t.passed).length, errors: row.errors }));
  }
}
await browser.close();
await fs.writeFile(artifactDir + '/report.json', JSON.stringify(report, null, 2));
console.log('TYPOGRAPHY_SUMMARY', JSON.stringify({ cases: report.length, tests: report.reduce((s, r) => s + r.tests.length, 0),
  passed: report.reduce((s, r) => s + r.tests.filter(t => t.passed).length, 0), failed: failureCount }));
if (failureCount) process.exitCode = 1;
