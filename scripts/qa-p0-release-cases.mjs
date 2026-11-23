import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = [process.env.CHROME_PATH, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/google-chrome'].find(path => path && existsSync(path));
assert.ok(executablePath, 'Chromium is required');
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const base = 'http://127.0.0.1:8080/legacy/';
const key = 'kona.legacy.v1.dayframe';
const target = '2026-11-20';
const earlier = '2026-11-19';
const later = '2026-11-21';
const raw = page => page.evaluate(key => window.localStorage.getItem(key), key);
const state = async page => JSON.parse(await raw(page));
let failures = 0;

async function run(label, test) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'Pacific/Honolulu', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    if (await page.locator('#tutorialChooseEn').isVisible()) await page.locator('#tutorialChooseEn').click();
    if (await page.locator('#welcomeSkip').isVisible()) await page.locator('#welcomeSkip').click();
    await page.evaluate(() => {
      document.getElementById('launchScreen')?.remove();
    });
    await test(page);
    assert.deepEqual(errors, []);
    console.log('PASS', label);
  } catch (error) {
    failures++;
    console.log('FAIL', label, error);
  } finally {
    await context.close();
  }
}

try {
  await run('P-03 single occurrence, cancel without write, whole series and reload', async page => {
    await page.evaluate(({ earlier, target, later }) => {
      db.events = [{ id: 'stage6-series', title: 'QA Stage Six Repeats', start: '09:00', end: '10:00', repeat: 'daily', days: [], since: earlier, until: later, category: 'personal', base: false }];
      db.overrides = {};
      db.skip = {};
      day(target).eventNotes['stage6-series'] = 'QA linked event memo';
      if (!save()) throw Error('Could not save recurrence fixture');
      changeDate(target);
      nav('schedule', { sub: 'events' });
    }, { earlier, target, later });

    const row = page.locator('#eventManageList .record-item').filter({ hasText: 'QA Stage Six' });
    const openOptions = () => row.click();
    await openOptions();
    await page.locator('#choiceList button').first().click();
    await page.locator('#ovTitle').fill('QA Stage Six One Day');
    await page.locator('#saveEventMemo').click();
    assert.deepEqual(await page.evaluate(dates => dates.map(d => dayEvents(d).find(e => e.id === 'stage6-series')?.title), [earlier, target, later]), ['QA Stage Six Repeats', 'QA Stage Six One Day', 'QA Stage Six Repeats']);

    const startSeriesEdit = async title => {
      await openOptions();
      await page.locator('#choiceList button').nth(1).click();
      await page.locator('#eventTitle').fill(title);
      await page.locator('#eventSave').click();
      assert.equal(await page.locator('#choiceList button').count(), 2);
    };

    const beforeCancel = await raw(page);
    await startSeriesEdit('QA Cancelled Edit');
    await page.keyboard.press('Escape');
    await page.locator('#eventFormModal [data-close]').click();
    assert.equal(await raw(page), beforeCancel);

    await startSeriesEdit('QA Stage Six All Days');
    await page.locator('#choiceList button').nth(1).click();
    let persisted = await state(page);
    assert.equal(persisted.events.length, 1);
    assert.equal(persisted.events[0].id, 'stage6-series');
    assert.equal(persisted.events[0].title, 'QA Stage Six All Days');
    assert.equal(persisted.days[target].eventNotes['stage6-series'], 'QA linked event memo');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await page.evaluate(dates => dates.map(d => dayEvents(d).find(e => e.id === 'stage6-series')?.title), [earlier, target, later]), ['QA Stage Six All Days', 'QA Stage Six One Day', 'QA Stage Six All Days']);
    persisted = await state(page);
    assert.equal(persisted.days[target].eventNotes['stage6-series'], 'QA linked event memo');
  });

  await run('R-03 Review deletion cancel, confirm, other record and Archive consistency', async page => {
    await page.locator('.tabs [data-page="capture"]').click();
    for (const text of ['QA Stage Six Keep Record', 'QA Stage Six Delete Record']) {
      await page.locator('#qc-note-title').fill(text + ' title');
      await page.locator('#qc-text').fill(text);
      await page.locator('#qc-submit').click();
    }
    const dates = Object.entries((await state(page)).days);
    const [date, records] = dates.find(([, value]) => value.quickCaptureEntries?.some(entry => entry.text === 'QA Stage Six Delete Record'));
    const entries = records.quickCaptureEntries;
    const removeId = entries.find(entry => entry.text === 'QA Stage Six Delete Record').id;
    const keepId = entries.find(entry => entry.text === 'QA Stage Six Keep Record').id;
    await page.locator('.tabs [data-page="records"]').click();
    await page.locator('#rev-reflect').click();
    const card = page.locator('#new-reflect-page .review-record').filter({ hasText: 'QA Stage Six Delete Record' });
    await card.locator('.rv-note-preview').click();
    const editor = page.locator('#konaReviewEditor');
    assert.equal(await editor.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), 'QA Stage Six Delete Record');
    const beforeCancel = await raw(page);
    await editor.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('.onharu-native-replacement .onharu-dialog-cancel').click();
    assert.equal(await raw(page), beforeCancel);
    assert.ok(await editor.isVisible());
    await editor.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('.onharu-native-replacement .onharu-dialog-accept').click();
    await editor.waitFor({ state: 'detached' });
    assert.equal(await card.count(), 0);

    await page.locator('#rev-archive').click();
    await page.locator('#archive-search .archive-records-search-button').click();
    const search = page.locator('#archive-search-input');
    const results = page.locator('#archive-search-results');
    await search.fill('QA Stage Six Delete Record');
    assert.ok(!(await results.innerText()).includes('QA Stage Six Delete Record'));
    await search.fill('QA Stage Six Keep Record');
    assert.ok((await results.innerText()).includes('QA Stage Six Keep Record'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const saved = (await state(page)).days[date].quickCaptureEntries;
    assert.ok(saved.some(entry => entry.id === keepId));
    assert.ok(!saved.some(entry => entry.id === removeId));
  });

  await run('N-01 selection survives tab round trips and history; Today is explicit', async page => {
    const chooseDate = page.locator('#datePicker');
    const go = name => page.locator('.tabs [data-page="' + name + '"]').click();
    const checkDate = async date => assert.equal(await chooseDate.inputValue(), date);
    await chooseDate.fill(target);
    await checkDate(target);
    for (const tab of ['today', 'capture', 'checkin', 'records', 'today']) {
      await go(tab);
      await checkDate(target);
    }
    for (const tab of ['records', 'checkin', 'capture', 'today']) {
      await page.goBack();
      await page.locator('#page-' + tab + '.active').waitFor();
      await checkDate(target);
    }
    await page.locator('#todayChip').click();
    await checkDate(later);
  });

  await run('K-12 edits to both past and future check-ins never affect today', async page => {
    const chooseDate = page.locator('#datePicker');
    await page.locator('.tabs [data-page="checkin"]').click();
    await page.locator('#page-checkin [data-phase="morning"]').click();
    const note = page.locator('#checkNote');
    await note.fill('QA today original');
    const today = (await state(page)).days[later].checkins;
    const future = '2026-11-22';
    for (const date of [target, future]) {
      await chooseDate.fill(date);
      await page.locator('#page-checkin [data-phase="morning"]').click();
      assert.equal(await chooseDate.inputValue(), date);
      await note.fill('QA selected ' + date);
      const saved = await state(page);
      assert.equal(saved.days[date].checkins.morning.note, 'QA selected ' + date);
      assert.deepEqual(saved.days[later].checkins, today);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    const saved = await state(page);
    assert.deepEqual(saved.days[later].checkins, today);
    assert.equal(saved.days[target].checkins.morning.note, 'QA selected ' + target);
    assert.equal(saved.days[future].checkins.morning.note, 'QA selected ' + future);
  });

  await run('E-02 task completion and its focus memo survive in Archive', async page => {
    const title = 'QA Stage Seven Task';
    const memo = 'QA task work summary';
    const updated = 'QA task work summary revised';
    const go = name => page.locator('.tabs [data-page="' + name + '"]').click();
    await go('capture');
    await page.locator('#captureTasks').getByRole('button', { name: 'Add task', exact: true }).click();
    await page.locator('#taskTitle').fill(title);
    await page.locator('#taskSave').click();
    const task = (await state(page)).tasks.find(entry => entry.title === title);
    assert.ok(task, 'Task was not saved');
    await page.locator('#captureTasks .capture-task-row').filter({ hasText: title }).locator('.task-start-btn').click();
    await page.locator('#focusStart').click();
    await page.locator('#focusNoteToggle').click();
    await page.locator('#timerNote').fill(memo);
    await page.clock.setFixedTime(new Date('2026-11-21T10:15:05-10:00'));
    await page.locator('#focusEnd').click();
    await page.locator('#choiceList button').first().click();
    const taskKey = task.id + '|single';
    const completed = await state(page);
    const session = completed.days[later].sessions.find(entry => entry.taskKey === taskKey);
    assert.ok(completed.checks[taskKey]);
    assert.equal(session?.note, memo);
    assert.equal(session.task, title);
    await go('records');
    await page.locator('#rev-reflect').click();
    const record = page.locator('#new-reflect-page .review-session-record').filter({ hasText: memo });
    assert.ok((await record.innerText()).includes(title));
    await record.locator('.rv-note-preview').click();
    const editor = page.locator('#konaReviewEditor');
    await editor.getByRole('textbox', { name: 'Note', exact: true }).fill(updated);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.getElementById('launchScreen')?.remove());
    await go('records');
    await page.locator('#rev-archive').click();
    await page.locator('#archive-search .archive-records-search-button').click();
    await page.locator('#archive-search-input').fill(title);
    const archive = page.locator('#archive-search-results .archive-search-result').filter({ hasText: updated });
    assert.equal(await archive.count(), 1);
    assert.equal(await archive.getAttribute('data-record-id'), 's-' + session.id);
    assert.equal(await archive.getAttribute('data-record-date'), later);
    const persisted = await state(page);
    assert.ok(persisted.checks[taskKey]);
    assert.equal(persisted.days[later].sessions.find(entry => entry.id === session.id)?.taskKey, taskKey);
  });

  await run('D-03 memo, schedule, check-in, prayer session and anchor survive reload', async page => {
    await page.evaluate(({ later }) => {
      const v = day(later);
      db.events.push({ id: 'stage6-reload-event', title: 'QA Stage Six schedule', start: '09:00', end: '10:00', repeat: 'none', days: [], since: later, category: 'personal', base: false });
      v.quickCaptureEntries ??= [];
      v.quickCaptureEntries.push({ id: 'stage6-reload-memo', title: 'QA title', text: 'QA memo', time: '09:00', createdAt: '2026-11-21T19:00:00Z', scheduleId: 'stage6-reload-event', tags: ['prayer'] });
      Object.assign(v.checkins.morning, { note: 'QA check-in', morningEnergy: 4, morningHappiness: 4 });
      v.sessions.push({ id: 'stage6-reload-session', kind: 'prayer', prayerId: '', note: 'QA prayer', start: '09:00', seconds: 180 });
      v.headline = 'QA anchor';
      if (!save()) throw Error('Could not save reload fixture');
    }, { later });
    const readRecords = () => page.evaluate(d => {
      const v = db.days[d];
      return { event: db.events.find(e => e.id === 'stage6-reload-event'), memo: v.quickCaptureEntries.filter(q => q.id === 'stage6-reload-memo'), session: v.sessions.filter(s => s.id === 'stage6-reload-session'), checkin: v.checkins.morning, headline: v.headline };
    }, later);
    const expected = await readRecords();
    assert.equal(expected.memo.length, 1);
    assert.equal(expected.session.length, 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await readRecords(), expected);
  });
} finally {
  await browser.close();
}
process.exitCode = Number(failures > 0);
