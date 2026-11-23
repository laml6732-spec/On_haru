# On_HARU Workers / Pages release handoff

This file documents the release path **without changing the live worker**. On_HARU stores personal journals in the browser's origin-scoped localStorage; the public Workers URL must remain stable.

## Release topology (verified 2026-11-23 UTC)

- Live entrypoint: `https://on-haru.laml6732.workers.dev/legacy/` — Cloudflare Worker `on-haru`
- Pages production project: `on-haru-pages`, `main`, built directly from GitHub `public/`
- The **live Worker script is not the same** as `cloudflare/on-haru-edge-preview.js` in Git; that tracked file is historical and must **not** be redeployed.
- Current live Worker contains `SOURCE = "https://3a7ed0a7.on-haru-pages.pages.dev"` and `x-on-haru-release = "captureios20261122a"`.
- The pending PR's actual HTML / Service Worker release is `safestor20261122d`. This is **not deployed** to the live Workers URL.
- The live Worker also rewrites startup-art HTML/service-worker assets, so exact-byte comparison must account for *only those documented transformations*; `scripts/verify-live-release.mjs` does this.

## Before touching production

1. Obtain an explicit production release authorization. Keep PR #84 in draft until that step.
2. Save a copy of the **currently deployed Worker script and version/deployment identifier**, and record its `SOURCE` and `x-on-haru-release`. This is the code rollback artifact; Git's historical edge-preview file is not a valid backup.
3. Verify the latest immutable Pages **Preview** URL belongs to the PR head commit, and that storage-safety, browser, PWA and alignment QA pass there using isolated synthetic records.
4. Ensure no user-data reset, domain migration, D1 mutation, or wholesale localStorage key rename is part of the release. User journal data is not in D1. Explain to users how to export their JSON backup from the existing live origin; the operator cannot export user local records centrally.
5. Coordinate the main-branch Pages release and the Worker repointing. Keep the `on-haru.laml6732.workers.dev` origin unchanged.

## Coordinated release procedure

1. Merge only the reviewed and verified PR to `main`. Wait for the new Pages production deployment to report **success** and record the **immutable deployment URL** and Git commit SHA.
2. In the **actual deployed Worker source**, modify **only** the `SOURCE` to that immutable Pages deployment URL and set `x-on-haru-release` to the release in `public/legacy/index.html` (same as `public/legacy/sw.js`). Do not replace the Worker with the obsolete Git edge-preview file or discard the existing startup-art/NLT routing logic.
3. Publish the new Worker version to the existing Worker name/route, retaining the previous version for rollback.
4. Verify using the repo's exact-content release checker and live browser checks:

   ```bash
   ONHARU_URL=https://on-haru.laml6732.workers.dev/legacy/ node scripts/verify-live-release.mjs
   ONHARU_URL=https://on-haru.laml6732.workers.dev/legacy/ node scripts/ui-smoke.mjs
   ONHARU_URL=https://on-haru.laml6732.workers.dev/legacy/ node scripts/ui-pwa.mjs
   ```

5. The release gate requires HTML/CSS/JS/service-worker hashes (or the specifically accepted startup transforms), a matching release header and embedded marker, real browser save/reload, offline reopening, and no new local-asset 404. Use an empty test browser profile on the live URL; never clear somebody else's site data.

## Rollback / failure handling

- If the Worker fails after publishing, redeploy the backed-up **previous Worker version** to the **same origin**. Because the Worker pins an immutable Pages deployment, its old source remains available. Preserve any live browser journal records.
- If the new application records need schema recovery, **do not** blindly downgrade their JSON: the new storage guard intentionally rejects future-version records. Recover from a verified user export or defer until compatible code is restored.
- If Pages passes but the Worker release header is stale, treat release verification as failed; update the Worker (not just GitHub docs) and repeat validation.
- Do not remove the original `onharu.myeram.chatgpt.site` or rename the current Workers origin as part of this work.

## Deferred architectural improvement

The current manual pinning of an immutable Pages deployment in a separate Worker makes Git/main and live Workers drift possible. Consider later making the *actual Worker source* reproducible in Git or a controlled build artifact and automating the source/header update with rollback support. Do not combine that architecture change with this small safety release.
