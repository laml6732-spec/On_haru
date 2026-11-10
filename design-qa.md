# Daily and Weekly review QA — 2026-11-10

Final result: passed with viewport coverage limitations below.

## Changes
- Daily retains the approved compact phase tint headers, mood emoji/name without written times, one schedule tag per linked group, full reflection, and independent 1.4px gray personal-note rails with the personal-note label.
- Weekly starts with week navigation/counts and a closed write/edit reflection control. The editor retains autosave, retry, next step, scripture/discernment, and completion.
- Each recorded day shows its saved daily reflection in full, explicitly highlighted/pinned records, a secondary daily intention, then closed other records. No arbitrary three-record preview and no duplication of important records in other records.
- Weekly personal notes have a separate 2px rail, first-line fallback at regular weight, written time at right, and no personal-note label. Linked notes/check-ins have no written timestamps; schedule time belongs in one pill per schedule.
- The original source/data schema and the existing production origin remain unchanged.

## Actual rendered inspection
Cloudflare branch preview: https://ea3364ac.on-haru-pages.pages.dev/legacy/
Commit: 277281931b5353eaa531bebb54ef050009c52438 (subsequent changes add the legacy responseReview field and square mood badges).

Using synthetic notes entered through the UI, verified:
- Korean Daily and Weekly render, the weekly tab is selected, and the saved reflection (447 characters) displays without truncation.
- Closed weekly editor displays only its write/edit control; raw records start closed and can be opened.
- Weekly insight and next step autosave; completion persists; reopening restores both values and offers undo completion.
- Highlighting an untitled personal note places it only in Important records; the remaining note stays in Other records.
- Untitled first-line heading computed weight is 400, no personal-note label is present in Weekly, and its personal rails compute to 2px.
- Light and dark appearances render; dark body text is rgb(224,233,225) on rgb(24,35,31).
- Current week and empty next week navigation work. Empty week shows its empty state while still allowing reflection writing.
- Wide viewport and 340/454 CSS-pixel widths via normal browser zoom: no horizontal overflow. Browser device emulation is unavailable; exact 320/390/1024 device emulation was not rerun. Zoom changes viewport height too, so this is narrower coverage than a full device matrix.
- The prior localhost error tab was not revisited or bypassed. The deployed HTTPS preview loaded normally.

## Code verification
- Static UI checks: 16 passed.
- Node tests: 16 passed (5 Weekly renderer/save/recovery tests, 4 daypart tests, 7 live-release verifier tests).
- Weekly tests cover full reflection/followup, ordering, important/raw disjoint sets, one linked schedule chip, end-of-day-only mood, autosave, complete, failed-save rollback, disabled empty-week completion, navigation, and Korean control text.
- JavaScript parse and git diff whitespace checks passed. Existing CSS inventory remains diagnostic; no blanket stylesheet cleanup was attempted.

## Deployment and rollback
- User explicitly authorized deployment. Production is GitHub main → on-haru-pages → the existing on-haru Worker origin.
- Pre-release production commit: 8cae18d2203adb4929b968c131a745b0ead66b42.
- Pre-release Cloudflare production deployment: 9fcc9e0c-9d42-494c-97a5-f897f2fa326d.
- Rollback: revert the merge commit on main, or roll the Pages production deployment back to that deployment. No stored-user-data conversion is involved.
- Production release attestation is performed after merging/deployment; do not infer deployment success from this document alone.
