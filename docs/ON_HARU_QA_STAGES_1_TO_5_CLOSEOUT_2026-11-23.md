# On_HARU QA 1–5 stages — verified closeout (2026-11-23 HST)

**Scope:** Code fixes and automated QA are complete on Draft PR #96. This document is **not** authorization to merge, deploy the Worker or claim that all 164 checklist cases passed.

## Exact tested snapshot

- PR: https://github.com/laml6732-spec/On_haru/pull/96
- Fully tested UI SHA: `a2d6d2605177ed96dabdb219e4e2a4101f18bef0`
- Main unchanged: `584f08155308bd942d6022eafdc71e161766f448`
- 23/23 GitHub Actions workflows **success** at the tested SHA, running Ubuntu Playwright/Chromium on synthetic records, never real user storage.
- 320/390/430/1024 CSS px × light/dark × Korean/English: 16 configs, **210/210 scripted checks**; no measured visible hit target under 24px; no horizontal overflow in the checked states. See https://github.com/laml6732-spec/On_haru/actions/runs/45250112950
- Six geometry matrices / 198 view states: **1,032/1,032 alignment conditions**. See https://github.com/laml6732-spec/On_haru/actions/runs/45250113858

## What was fixed and independently verified

1. PR #94: English Review weekday localization without changing Korean dates. https://github.com/laml6732-spec/On_haru/actions/runs/45250113106
2. PR #95: strict Worker release-header verification, safe Worker patch preparation (NOT live deployment). https://github.com/laml6732-spec/On_haru/actions/runs/45250112530
3. New P0 source fix: splitting a recurring series at a selected date now transfers future Capture links, title/time, event note title/body/tags/moods, event-info, time-notes, sessions and date-scoped markers to the new ID while preserving historical dates, skips/overrides and reload persistence. https://github.com/laml6732-spec/On_haru/actions/runs/45250113209 and issue #97.
4. P0 timer: start, pause, resume, reload, rejected/accepted cancel, explicit finish and exactly-once persistence. https://github.com/laml6732-spec/On_haru/actions/runs/45250112861
5. Existing storage safety, full P0 boundary journeys, Review editing, Capture schedule selection, prayer record filtering, morning flower/anchor and other component suites re-run on the exact integrated SHA. https://github.com/laml6732-spec/On_haru/actions/runs/45250113805 and https://github.com/laml6732-spec/On_haru/actions/runs/45250113341

## QA checklist (164) — evidence-based status

| Priority | Total | PASS | FAIL (production) | Unverified / insufficient complete evidence |
|---|---:|---:|---:|---:|
| P0 | 43 | 15 | 0 | 28 |
| P1 | 104 | 7 | 2 | 95 |
| P2 | 17 | 0 | 0 | 17 |
| **Total** | **164** | **22** | **2** | **140** |

The original document had 15 PASS / 2 FAIL / 147 pending. Seven **fully automated acceptance cases** were newly marked PASS: C-05, K-04, R-04, F-01, F-03, F-07 and F-08. **Do not treat 23 successful workflows or 210 scripted assertions as 164 release checklist PASS cases.** Combined manual/automated cases retain pending status until *both* sets of requirements have evidence.

**Two previously confirmed production failures remain OPEN, because no production deployment was made**:
- S-03 / issue #93: English Review weekday is fixed in the Draft PR, but not yet in live.
- D-09 / issue #7: live Worker `x-on-haru-release` header drift; correct Worker patch and deployment must be separately approved, backed up and tested.

## Remaining required manual/device QA

- Real iPhone Safari: text-entry zoom, Korean IME composition, soft keyboard occlusion/return, safe area, double tap, installable PWA and background/lock timer.
- Android Chrome physical keyboard/touch/PWA, VoiceOver and TalkBack screen-reader operation.
- Visual baseline review of 320/390/430/1024 screens, text/non-text WCAG contrast checks (4.5:1 / 3:1), modal interaction with a real pointer/finger, long text density and visual hierarchy.
- Unverified P0 branches incl. whole-series edit/cancel (beyond the verified 'from this day onward' split), actual-device date/time boundary cases and long-form 7-day journeys.
- The app uses a Safari-specific `@supports(-webkit-touch-callout: none)` + coarse pointer CSS rule to enforce 16px input text. The Chromium observation of 13.5px fonts **does not verify Safari behavior**.

## Release decision

**STAGES 1–5: AUTOMATED CODE/QA WORK COMPLETE, MANUAL PORTION DOCUMENTED AS UNVERIFIED.**
**RELEASE: HOLD.** Do not mark 164-case QA as fully signed off, merge, change production origin, or redeploy the Worker without the Stage 6 release gate and user authorization for Stage 7.

The full 164-row evidence matrix is also provided as a standalone Markdown QA handoff file in the conversation.
