/* iOS Safari: respect the visual viewport without forced zoom or scroll reset. */
(() => {
  const isIOSTouch = /iP(?:hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const view = window.visualViewport;
  if (!isIOSTouch || !view) return;

  const root = document.documentElement;
  let normalHeight = view.height;
  let keyboardOpen = false;
  let frame = 0;
  let shouldReveal = false;

  const isEditor = el => el instanceof HTMLElement &&
    el.matches('textarea, input:not([type]), input:is([type="text"],[type="search"],[type="email"],[type="tel"],[type="url"],[type="password"],[type="number"]), [contenteditable="true"], [contenteditable=""]') &&
    !el.hasAttribute('disabled') && !el.hasAttribute('readonly');

  function revealEditor() {
    if (!keyboardOpen) return;
    const field = document.activeElement;
    if (!isEditor(field)) return;
    const rect = field.getBoundingClientRect();
    const top = view.offsetTop + 12;
    const bottom = view.offsetTop + view.height - 20;
    const delta = rect.bottom > bottom ? rect.bottom - bottom :
      rect.top < top ? rect.top - top : 0;
    if (Math.abs(delta) < 5) return;
    const sheet = field.closest('.modal-under:not([hidden]) .sheet');
    if (sheet) sheet.scrollTop += delta;
    else window.scrollBy({top: delta, left: 0, behavior: 'instant'});
  }

  function sync() {
    frame = 0;
    const active = isEditor(document.activeElement);
    // Browser toolbars can change viewport height without showing a keyboard.
    if (!active && !keyboardOpen) normalHeight = view.height;
    if (active && !keyboardOpen && view.height > normalHeight) normalHeight = view.height;

    const missing = Math.max(0, normalHeight - view.height);
    const threshold = Math.max(110, normalHeight * 0.18);
    // Keep the sheet in place through the keyboard-dismiss animation.
    const opened = keyboardOpen ? missing > 60 : active && missing > threshold;
    const changed = keyboardOpen !== opened;
    keyboardOpen = opened;
    root.classList.toggle('onharu-ios-keyboard-open', opened);

    if (opened) {
      root.style.setProperty('--onharu-visible-height', `${Math.round(view.height)}px`);
      root.style.setProperty('--onharu-visible-top', `${Math.max(0, Math.round(view.offsetTop))}px`);
      root.style.setProperty('--onharu-keyboard-space', `${Math.ceil(missing)}px`);
      if (changed || shouldReveal) requestAnimationFrame(revealEditor);
    } else {
      root.style.removeProperty('--onharu-visible-height');
      root.style.removeProperty('--onharu-visible-top');
      root.style.removeProperty('--onharu-keyboard-space');
      if (!active) normalHeight = view.height;
    }
    shouldReveal = false;
  }

  function schedule(reveal = false) {
    shouldReveal ||= reveal;
    if (frame) return;
    frame = requestAnimationFrame(sync);
  }

  document.addEventListener('focusin', event => {
    if (isEditor(event.target)) schedule(true);
  });
  document.addEventListener('focusout', () => schedule());
  view.addEventListener('resize', () => schedule(true));
  view.addEventListener('scroll', () => schedule());
  window.addEventListener('resize', () => schedule());
  window.addEventListener('orientationchange', () => {
    if (!keyboardOpen) normalHeight = view.height;
    schedule();
  });
  window.addEventListener('pageshow', () => schedule());
})();
