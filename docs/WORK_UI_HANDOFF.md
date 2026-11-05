# On_HARU: Work-mode UI QA and CSS refactor handoff

Updated: 2026-11-04 (Hawaii). This is an action plan, not a claim that all testing is complete.

## Goal and live project

- GitHub: `laml6732-spec/On_haru`, production branch `main`.
- Cloudflare Pages: `on-haru-pages`, root `/`, output `public`, no build command.
- Production: https://on-haru-pages.pages.dev/legacy/
- Original legacy site is separate. Do not change or delete it.
- Do not add "move your records to another address" instructions to the in-app tutorial.
- Data is browser-local. Do not clear `localStorage`, use real personal data, or run destructive restore/reset on a real user's session.

## Current completed UI fixes

- Welcome tutorial illustration now uses `assets/onharu-welcome.png`.
- Capture emoji More/Less stays in top-right of first row.
- Event/task form fields and Important switch share a visual style.
- Browser-native `confirm()` and `prompt()` calls replaced with On_HARU dialogs.
- Settings spacing, Plan button hit areas, Review no-record empty state refined.
- **Dark-mode memo readability:** new dark-targeted colors for Capture notes, Review notes, Plan snippets, and writing fields; actual deployed Capture and Review with demo notes have been viewed.
- **Short name:** `#eventShortNameDetails` wraps the optional controls; closed on initial add AND edit; expanding leaves `eventShortTitle`, `eventShortPreview`, `shortTitleScope` operational.
- Updated PWA cache-release marker in HTML and service worker: `d3926b0f4e17`. Preserve matching markers when editing CSS/JS.

## Files to inspect

| File | Purpose |
| --- | --- |
| `public/legacy/index.html` | UI template, form structure, assets/release marker |
| `public/legacy/app.7cb1b71d4eb6.css` | Large legacy CSS cascade with accumulated overrides |
| `public/legacy/runtime/legacy-controllers.9a6fbb5e22cc.js` | Business logic, i18n catalog, event editing, user data |
| `public/legacy/sw.js` | Offline shell and asset-cache version |
| `scripts/verify-ui-static.mjs` | No-dependency structural checks |
| `scripts/audit-css.mjs` | Read-only CSS inventory; never deletes CSS |
| `scripts/ui-smoke.mjs` | Isolated Chromium tests and screenshots |

## CSS baseline: prioritize safely

Last reviewed CSS contained ~559,719 characters, **5,477 `!important`** uses, and **676 repeated exact selector groups** with a simple diagnostic scanner. Counts are signals, not proof of a bug.

High-risk rule: `html[data-appearance=dark] body .app *{color:inherit!important;border-color:#44594c!important}`. It can force unwanted inheritance and conflicts with hard-coded light-theme colors (e.g. `.capture-recent-body`). Dark note-specific overrides were added **without mass removal of legacy styles**. Some dark navigation/metadata may still merit separate contrast checks.

Do **not** automatically deduplicate or rewrite the entire CSS file. Instead:

1. Create a dedicated Git branch from the exact current `main`.
2. Collect baseline screenshots in light/dark at 320, 390 and 1024px, populated with isolated sample notes.
3. Group old rules by component and theme; inspect specificity/order, then remove only verified equivalent rules in small commits.
4. After each component change, compare screenshots and run the tests below.
5. If layout differs unexpectedly, roll back that component. Merge only after verified parity.

## Run locally without changing production

Terminal A:

```sh
python3 -m http.server 8080 --directory public
```

Terminal B:

```sh
node scripts/verify-ui-static.mjs
node scripts/audit-css.mjs --json
npm install --no-save --no-package-lock playwright-core@1.56.1
ONHARU_URL=http://127.0.0.1:8080/legacy/ node scripts/ui-smoke.mjs
```

For Chromium: the runner detects Playwright's cached Chromium or system Chrome; otherwise install Chromium or set `CHROME_PATH`. Visual screenshots and JSON results go to `test-results/onharu-ui/`. The UI smoke uses **isolated browser contexts**, never a user's session. A GitHub Action `ui-static-checks.yml` runs static checks automatically.

## Functional regression matrix

| Area | User paths to test |
| --- | --- |
| First run / tutorial | language selection; Korean typography; brand image; Skip; guided practice; Mood/Energy step |
| Write / Capture | typed note; title optional; emoji tags; More/Less two-row layout; plan linking; save; recent note; dark/light |
| Check-in | Morning/Energy/Mood; Class review notes; Evening; automatic save; Review reflects the notes |
| Plan | add/edit event; **short name initially collapsed**; expand/save; category; recurring scope; task add/edit/complete |
| Focus | timer start/pause/end; switching duration; prayer request actions; devotional prompt; saved session |
| Review | Daily/Weekly/Archive; empty state; note content; filter; edit; delete confirmation; linked task |
| Settings | language; light/dark/system; text scale; theme persistence; UI layout; backup/restore **only with fabricated data** |
| App/PWA | HTML/JS/CSS load; service-worker version; no unexpected 404; app install and offline shell |

### Visual acceptance criteria

- Dark note bodies and input text have **WCAG AA contrast ≥ 4.5:1** against their immediate card/background when measured in a rendered browser.
- 320/390px: no horizontal page overflow, clipped controls, or overlapping dock/modals.
- On event dialog open: optional short-name details are closed; expanding reveals all original controls; saved short names stay intact.
- Capture More/Less top position remains fixed between collapsed/expanded states.
- Browser-native `prompt()`/`confirm()` do not appear for user actions.
- Korean and English labels remain readable; focus and keyboard Escape work for dialogs.
- No unintended changes to user storage schema, keys, events, saved notes, check-ins, or settings.
- Run static checks, local smoke, and human screenshot review **before** touching deployment.

## Work mode minimal mission

Use this exact order: **(1)** run `verify-ui-static` + `audit-css`; **(2)** run `ui-smoke` and inspect artifacts; **(3)** fill the remaining test matrix including real modal interactions and dark-mode contrast; **(4)** isolate/clean CSS on a branch in small component batches; **(5)** rerun tests and deploy only proven improvements.

The current GitHub main and Cloudflare Pages deployment remain the baseline. Do not replace the design, rename On_HARU, recreate the application, reset real data, or change the backup/tutorial UX. No broad rewrite is authorized.
