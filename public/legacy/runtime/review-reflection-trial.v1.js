/* Review reflection-first trial. Reversible: remove this script/style on its feature branch. */
(function () {
  'use strict';
  if (window.__onharuReviewTrial || typeof renderRecords !== 'function' || typeof renderCalendar !== 'function' || typeof db === 'undefined') return;
  const root = document.getElementById('page-records');
  const tabs = document.getElementById('new-review-switch');
  const panel = document.getElementById('new-reflect-page');
  const month = document.getElementById('viewCal');
  const legacyLog = root && root.querySelector('[data-review-panel="log"]');
  if (!root || !tabs || !panel || !month || !legacyLog) return;
  window.__onharuReviewTrial = true;
  root.classList.add('onharu-reflection-trial');

  const paletteLight = [
    ['#D1D5EA','#CFDCE8','#CDDEE0','#C7E3DA','#BCE2D7'],
    ['#D9CCE5','#D7D8E4','#D0DED8','#C7E2D5','#B9E2CE'],
    ['#E5D1DD','#E1D4DB','#DAD7CE','#DDE2C5','#D6E3B6'],
    ['#EDC5CD','#EECFCE','#EFD8C6','#EFDFB5','#F0D097'],
    ['#E7AAB8','#EAB7B5','#EDC6B5','#EDC49B','#E9B47A']
  ];
  const paletteDark = [
    ['#675477','#5D617A','#4D6977','#3E7376','#397568'],
    ['#75577F','#6A6080','#53727A','#3C796F','#417A60'],
    ['#805978','#74657D','#617372','#537C69','#5D7C55'],
    ['#8A576D','#815E70','#7D6A68','#7E7159','#877348'],
    ['#8E5363','#945D62','#8E685C','#906B4F','#95683D']
  ];
  const t = (en, ko) => (typeof KonaI18n !== 'undefined' && KonaI18n.dateLocale && KonaI18n.dateLocale.startsWith('ko')) ? ko : en;
  const rating = value => value !== null && value !== undefined && value !== '' &&
    Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;

  // Read the same four check-in sources as the modern Mood browser; exclude unpaired scores.
  function dailyPair(dateKey) {
    const checks = db.days[dateKey]?.checkins || {};
    const values = ['morning','noon','evening','night'].map(phase => {
      const check = checks[phase]; if (!check) return null;
      const mood = check.mood || {};
      const e = rating(check[phase + 'Energy'] ?? check[phase + KonaI18n.t('Energy')] ?? mood.energy ?? mood.e);
      const h = rating(check[phase + 'Happiness'] ?? check[phase + KonaI18n.t('Happiness')] ?? mood.happiness ?? mood.v);
      return e === null || h === null ? null : {e, h};
    }).filter(Boolean);
    if (!values.length) return null;
    return {e: Math.round(values.reduce((sum, value) => sum + value.e, 0) / values.length),
            h: Math.round(values.reduce((sum, value) => sum + value.h, 0) / values.length),
            count: values.length};
  }

  const formerCalendar = renderCalendar;
  function paintCalendar() {
    const grid = document.getElementById('monthCalendar');
    if (!grid || typeof calendarMonth !== 'string') return;
    const first = new Date(calendarMonth + '-01T12:00:00Z');
    const offset = (first.getUTCDay() + 6) % 7;
    const buttons = [...grid.querySelectorAll('button.daycell')];
    const colored = typeof calendarMode !== 'undefined' && calendarMode === 'mood';
    buttons.forEach((button, index) => {
      const d = new Date(first); d.setUTCDate(1 + index - offset);
      const dateKey = d.toISOString().slice(0, 10);
      const pair = dailyPair(dateKey);
      button.dataset.reviewDate = dateKey;
      button.classList.remove('onharu-calendar-day-tone');
      button.style.removeProperty('--onharu-calendar-light');
      button.style.removeProperty('--onharu-calendar-dark');
      if (colored && pair) {
        button.classList.add('onharu-calendar-day-tone');
        button.style.setProperty('--onharu-calendar-light', paletteLight[pair.e-1][pair.h-1]);
        button.style.setProperty('--onharu-calendar-dark', paletteDark[pair.e-1][pair.h-1]);
      }
      button.setAttribute('aria-label', dateKey + (pair ? ' · ' + t('Mood ','기분 ')+pair.h+'/5 · '+t('Energy ','에너지 ')+pair.e+'/5' : ''));
    });
  }
  renderCalendar = function () {
    const result = formerCalendar.apply(this, arguments);
    paintCalendar();
    return result;
  };

  // The built-in Review controller still owns all data, editing and saving.
  // Only move or flatten the existing presentation; never create a second data store.
  let activeMood = false, openingMood = false;
  const daily = document.getElementById('rev-reflect');
  const weekly = document.getElementById('rev-weekly');
  const archive = document.getElementById('rev-archive');
  const mood = document.createElement('button');
  mood.id = 'rev-mood';
  mood.type = 'button';
  mood.textContent = t('Mood', '감정');
  mood.setAttribute('aria-pressed', 'false');
  mood.setAttribute('aria-label', t('Mood trends', '감정 추세'));
  tabs.insertBefore(mood, archive);

  function syncTabs() {
    [daily, weekly, archive, mood].forEach(button => {
      if (!button) return;
      let selected = button.classList.contains('on');
      if (button === mood) selected = activeMood;
      if (button === archive && activeMood) selected = false;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    root.classList.toggle('onharu-mood-active', activeMood);
    root.classList.toggle('onharu-archive-active', !activeMood && !!archive?.classList.contains('on'));
  }
  daily?.addEventListener('click', () => { activeMood = false; syncTabs(); });
  weekly?.addEventListener('click', () => { activeMood = false; syncTabs(); });
  archive?.addEventListener('click', () => {
    if (openingMood) return;
    activeMood = false;
    const records = root.querySelector('.archive-mood-view-switch button:first-child');
    if (records && records.getAttribute('aria-pressed') !== 'true') records.click();
    syncTabs();
  });
  mood.onclick = () => {
    openingMood = true;
    archive?.click();
    openingMood = false;
    const picker = root.querySelector('.archive-mood-view-switch button:last-child');
    if (picker && picker.getAttribute('aria-pressed') !== 'true') picker.click();
    activeMood = true;
    syncTabs();
    root.querySelector('.archive-mood-heading')?.scrollIntoView({block:'nearest'});
  };

  const previousRender = renderRecords;
  renderRecords = function () {
    // Preserve the original calendar element when Daily is torn down.
    if (month.parentElement === panel) legacyLog.append(month);
    const result = previousRender.apply(this, arguments);
    const isReviewPage = typeof page !== 'undefined' && page === 'records';
    if (!isReviewPage) return result;
    if (daily?.classList.contains('on')) {
      const head = panel.querySelector('.rv-daily-head');
      if (head) panel.insertBefore(month, head);
      // Reflection is the primary action, not an extra card below all records.
      const editor = panel.querySelector('#dailyReflectionEditor');
      if (editor) {
        editor.hidden = false;
        editor.classList.add('onharu-reflection-primary');
      }
      const button = panel.querySelector('.review-write-reflection');
      if (button) {
        button.textContent = t('Write reflection', '회고 작성');
        button.setAttribute('aria-expanded', 'true');
        button.onclick = () => {
          const input = editor?.querySelector('.rv-journal-main textarea');
          input?.scrollIntoView({block:'center'});
          input?.focus({preventScroll:true});
        };
      }
      // A date's records remain immediately available below the journal.
      const timeline = panel.querySelector('.rv-timeline');
      if (timeline && editor) timeline.before(editor);
    } else if (weekly?.classList.contains('on')) {
      const records = panel.querySelector('.review-weekly-records');
      if (records) {
        const details = document.createElement('details');
        details.className = 'onharu-weekly-source';
        const summary = document.createElement('summary');
        summary.textContent = t('Browse this week’s original records', '이번 주 원본 기록 보기');
        details.append(summary, records);
        panel.append(details);
      }
      // Reflection text fields and next actions stay in the original save flow.
    }
    // If a new view has replaced the archive contents, repair Mood selection.
    if (activeMood && archive?.classList.contains('on')) {
      const picker = root.querySelector('.archive-mood-view-switch button:last-child');
      if (picker && picker.getAttribute('aria-pressed') !== 'true') picker.click();
    }
    syncTabs();
    paintCalendar();
    return result;
  };
  // Initial state is the familiar full-color calendar, but user can switch to Entries.
  if (typeof calendarMode !== 'undefined') calendarMode = 'mood';
  renderRecords();
})();