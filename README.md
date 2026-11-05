# On_HARU

On_HARU is a bilingual, offline-friendly faith reflection and daily-notes PWA. The original legacy UI remains at `public/legacy/`.

## Production (GitHub → Cloudflare Pages)

- **Official Pages URL:** https://on-haru-pages.pages.dev/legacy/
- **Repository:** `laml6732-spec/On_haru`, `main` branch
- **Cloudflare Pages project:** `on-haru-pages`
- **Build:** no build command; output directory `public`
- Commits to `main` trigger automatic Pages deployments.
- The older edge proxy is a separate preview at https://on-haru.laml6732.workers.dev/legacy/.
- The original app at https://onharu.myeram.chatgpt.site/legacy/ is separate and should remain unchanged.

## Current work and test instructions

For the detailed UI cleanup scope, status, risks, acceptance criteria and Work-mode handoff, read [docs/WORK_UI_HANDOFF.md](docs/WORK_UI_HANDOFF.md).

```sh
# Terminal 1: local server for UI checks
python3 -m http.server 8080 --directory public

# Terminal 2: fast structural scan and CSS diagnostics
node scripts/verify-ui-static.mjs
node scripts/audit-css.mjs

# Browser checks (uses a new isolated test profile)
npm install --no-save --no-package-lock playwright-core@1.56.1
ONHARU_URL=http://127.0.0.1:8080/legacy/ node scripts/ui-smoke.mjs
```

A GitHub Actions workflow runs static structural checks on relevant source pushes. Browser smoke screenshots are stored in `test-results/onharu-ui/` when executed.

## Safety / storage

Personal notes and records are stored in the current browser profile. Do not modify the existing storage schema or keys, clear local data, or test destructive operations in a real user's browser. Test with isolated temporary browser contexts and fabricated entries.

When changing asset references, update the **same** release marker in both `public/legacy/index.html` and `public/legacy/sw.js` so installed PWA clients do not keep outdated CSS/JavaScript. Do not change visual design or core behavior as part of unrelated deployment maintenance.
