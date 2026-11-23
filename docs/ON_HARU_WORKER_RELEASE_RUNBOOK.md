# On_HARU Workers / Pages release handoff

This file documents the release path **without changing the live worker**. On_HARU stores personal journals in the browser's origin-scoped localStorage; the public Workers URL must remain stable.

## Release topology (observed 2026-11-23 UTC; verify again before release)

- Live entrypoint: `https://on-haru.laml6732.workers.dev/legacy/` — Cloudflare Worker `on-haru`
- Pages production project: `on-haru-pages`, `main`, built directly from GitHub `public/`
- The **live Worker script is not the same** as `cloudflare/on-haru-edge-preview.js` in Git; that tracked file is historical and must **not** be redeployed.
- Current live Worker (read through Cloudflare API on 2026-11-23) contains `SOURCE = "https://530298dd.on-haru-pages.pages.dev"` and `x-on-haru-release = "safesave20261123b"`, while its Pages target is commit `23c67417` with HTML/SW release `prayerrecords20261123a`. **The old header is a verified deployment-marker bug.**
- Draft PR #94 has HTML/SW release `reviewweekday20261123a` and a passing Preview QA. It is **not deployed to the live Workers URL**.
- The live Worker also rewrites startup-art HTML/service-worker assets, so exact-byte comparison must account for *only those documented transformations*; `scripts/verify-live-release.mjs` does this.

## Repair the observed release-header mismatch without replacing the Worker

The active `on-haru` script is a **legacy service-worker-syntax** bridge with embedded startup image data, origin routing, and custom asset transforms. The old `cloudflare/on-haru-edge-preview.js` is not suitable for this release. **Do not upload a replacement based on that file.** Cloudflare's Version Upload API requires module-syntax Workers; do not rewrite this script to module syntax just to stage a header change.

Before any approved Worker deployment, export/download the **current live Worker source** privately from Cloudflare and back up the active deployment/version ID. For the currently deployed source and matching Pages assets, create an exact one-header-only patch with:

```bash
node scripts/prepare-worker-release.mjs \
  --source /private/current-on-haru-worker.js \
  --out /private/on-haru-header-corrected.js \
  --old-release safesave20261123b \
  --pages-url https://530298dd.on-haru-pages.pages.dev
```

The script compares HTML/SW release markers, the expected current header, the immutable Pages `SOURCE` and bridge identity. It refuses to run when any of these preconditions change, preserves all other bytes, and writes a new private output file without overwriting the backup. It **does not deploy** anything.

**Important:** If PR #94 is merged before the Worker update, its new HTML/SW marker `reviewweekday20261123a` must be paired with the actual new immutable Pages deployment URL. In that situation, **do not** apply the old-source, header-only patch to a different Pages deployment. Follow the coordinated release procedure instead: first verify Pages, then update `SOURCE` and `x-on-haru-release` together in the backed-up live Worker source.

- The Worker production verifier now requires the matching `x-on-haru-release` header for the Workers origin, in addition to SHA-256 content verification and the HTML/SW embedded markers. Direct Pages preview origins may omit this Worker-only header.
- Before publishing, verify the patched Worker source byte-level diff, review the existing bindings and routes, and save both the active Worker source and deployment version as rollback evidence.
- A prepared source file or a green unit test is **not** evidence of a corrected production Worker. After approved deployment, rerun the exact live verifier and check the header over the original workers.dev URL.

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
