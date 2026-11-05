/* Anonymous install and usage measurement. Does not access On_HARU notes. */
(() => {
  'use strict';
  const ENDPOINT = 'https://onharu-metrics.laml6732.workers.dev/event';
  const KEY = 'onharu.metrics.anonymous-device.v1';
  const allowed = ['on-haru.laml6732.workers.dev', 'on-haru-pages.pages.dev'];
  if (!allowed.includes(location.hostname)) return;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  if (!crypto || typeof crypto.randomUUID !== 'function') return;

  let id;
  try {
    id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
  } catch {
    return;
  }
  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function send(event) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          v: 1, id, event, mode: standalone() ? 'standalone' : 'browser'
        })
      }).catch(() => {}); // Offline or blocked tracking must not affect app.
    } catch { /* Analytics are optional. */ }
  }

  send('visit'); // Once on each page load; D1 deduplicates daily devices.
  window.addEventListener('appinstalled', () => send('install'));
})();
