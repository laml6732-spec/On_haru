# On_HARU · Scripture Memory v1 — UI / product / implementation specification

> Status: isolated proposal & prototype only · 2026-11-13  
> Scope: Write daily entry → Focus/Devotion practice → Review-linked Scripture Library  
> Base: `content/nlt-popular-100-20261113` (PR #66, unmerged). **Do not merge, deploy, alter production, or modify existing browser data.**  
> Design authority: user-provided `DESIGN.md` dated 2026-11-06 + current GitHub `main` runtime. The HTML initially declares four tabs, but runtime controller `14-capture-tabs-controller.js` inserts Write (`data-page=capture`), renames legacy `today` to Plan, and reorders the navigation. **Rendered bottom navigation is Write / Check-in / Plan / Focus / Review (five tabs)**. Follow runtime, not bare HTML.

## 1. Goal and constraints

### User outcome
- Open Write and see **one clear next scripture action** without another card or an automatic new verse every calendar day.
- Enter Focus/Devotion to **read → hide and recall → self-check**, with **no timer required**.
- Use a separate Scripture Library linked from Review/Archive and Focus to browse the 100 passages and revisit completed ones.
- Do not turn verse counts into a spiritual score, streak, or compulsory religious task.

### Non-goals (v1)
- No new bottom navigation tab; no Check-in or Plan modification; no mandatory journaling.
- No pronunciation grading, AI-generated theological commentary, flashcard quiz engine, streak, gamification, push alerts, automatic daily advancement, or backend account/sync.
- No NLT verse text copied to the repository or stored in public assets.

### Current constraints
- App: no-build static PWA rooted at `public/legacy/`; JS can alter static layout. Dynamic navigation and CSS overrides require rendered QA.
- `main` commits auto-trigger Cloudflare Pages deployment; this proposal is isolated in a branch and **must not be merged** without explicit approval.
- User data is device/browser local; do not touch existing `kona.legacy.v1.dayframe`, prayer, note, calendar, timer, or current backup data.
- Data PR #66 has exactly 100 distinct NLT *references*, not verse bodies or a curated set of topic titles.
- NLT distribution is licensed; original text must come only from a provider/API with applicable app and caching rights. Do not ship from scraped public webpages.

## 2. Information architecture

```text
Write (Capture, existing tab)
  └─ "말씀 이어하기" (one compact row, only on actual today)
        └─ Focus / Devotion → Scripture practice overlay
Check-in (unchanged)
Plan (legacy page id: today; unchanged)
Focus
  ├─ Pray (unchanged)
  ├─ Devotion (existing timer/topic unchanged)
  │    └─ "말씀 암송" secondary entry → Scripture practice overlay
  └─ Focus (unchanged)
Review
  ├─ Daily / Weekly (unchanged)
  └─ Archive (existing records & mood filters unchanged)
        └─ "말씀 서재" separate entry → Library overlay
               └─ Select a passage → practice overlay, opens through Focus
```

- The Scripture Library is **not** a new Archive record category. The 100 catalog items are published content, not user notes or saved devotional sessions.
- The practice overlay is a lightweight, mobile-first focus surface; it is not a replacement for the existing Focus timer.
- A verse is tracked using a stable passage ID such as `1-corinthians-13-4-5`, not an array index.

## 3. Write daily entry — exact layout

**Placement:** inside runtime-created `#page-capture` (the real Write tab), immediately **after `#qc-v2` (existing note composer)** and before `#capture-home`. Do not use `#page-today`: runtime renames that area **Plan**. Keep the anchor and note entry as primary content. Inspect the live DOM insertion order before implementation because scripts move the composer, priority task and daily signature.

**Appearance:** single full-width clickable text row, thin top/bottom hairline only, no new colored card. Row height auto, minimum 52px, whole row hit target at least 44px. Side padding 0–4px; leading open-book icon 16–18px; chevron 14px; gap 8px. Main reference 13.5–14px/600, status 12px/400; long references may wrap naturally to two lines (no ellipsis that hides book/verses). Match `--ink`, `--sub`, `--line`, scaled typography.

**Label variants (Korean / English):**
- First visit: `말씀 시작하기` / `Start scripture memory` + `1 Corinthians 13:4–5`
- Active passage and no review due: `말씀 이어하기` / `Continue scripture` + reference + `가리고 암송해 보세요`
- Review due: `오늘 복습할 말씀` / `Scripture to review` + earliest due reference; if additional due, `외 2개`
- Already self-checked today: `오늘 연습했어요` / `Practiced today` + reference, tappable to repeat; never disabled.
- All complete/no due: `말씀 다시 읽기` / `Revisit scripture`, with library path.

**Visibility:** when the header date picker browses a non-current day while on Write, hide this practice row entirely; don't attach a study session to a past schedule. The date/current-day determination must align with the app's active timezone; confirm timezone helper in runtime. No date-based punishment for skipped days.

**Interaction:** click opens Focus-selected scripture overlay on the requested passage. Do not auto-start timer or auto-mark practice. Failure to load scripture never affects notes/tasks.

## 4. Focus/Devotion — Scripture practice

**Entry:** a light secondary row labeled `말씀 암송` / `Scripture memory` inside current Devotion controls, separate from the existing free-text scripture/topic and timer. Current Pray / Devotion / Focus segment positions stay intact. Tapping from Write or Library opens the same view.

**Overlay layout (full-height within app at mobile width, not nested cards):**
1. Sticky top: back/close (44px target), `말씀 암송` title, progress `07/100` as quiet metadata.
2. Reference line: `Philippians 4:6–7 · NLT`, with copyright attribution and source link when required.
3. Segmented control `읽기` / `가리고 암송`, two equal-width targets ≥44px.
4. Main reading body: plain book-like typography, 16px at default, line-height 1.6, selectable text, verse numbers if provided; never fixed-height/truncated. 15–16px minimum preferred for expanded reading, CSS-scaled with `--kona-ui-scale`.
5. In recall mode, replace text with a quiet prompt and option `본문 다시 확인`. Do not display a fill-in-the-blank based on copyrighted NLT text in a locally committed prototype.
6. One primary action in the current context: `암송 점검하기` / `Check recall`.
7. Self-assessment sheet: `기억했어요 / 일부만 기억했어요 / 기억나지 않아요` (recalled / partial / forgot), save once, provide clear saving/saved/error messaging. An explicit secondary `암송 완료로 표시` is separate; don't equate one practice with memorization.
8. Quiet secondary actions `본문 문맥 보기` (authorized external source) and `생각 남기기` (existing note flow only by deliberate user action). Do not create auto-logged journal records.

**Timer:** the existing timer is unchanged and optional. Entering/leaving practice must not pause, stop or replace an already running session; default prototype does not integrate timer.

**Close / navigation:** preserve scroll and selected passage in memory, close with Escape, Android Back, and visible back button; restore prior focus. If a self-check save is pending, never show success prematurely. Let users back out without losing previously saved practice.

## 5. Scripture Library (from Review Archive)

**Placement:** a quiet `말씀 서재 100개` / `Scripture Library · 100` navigation row after Archive's own header. It does not join existing archive type/search records or change their semantics. Also accessible via Focus.

**Layout:**
- Header: back, `말씀 서재`, optional 100 count.
- Summary: `암송 완료 18/100` (sample), `오늘 복습 2개`; these are **not additive** categories.
- Filters: `전체`, `학습 중`, `암송 완료` as an existing-style segmented control; `복습 필요` may be a quick-link, not another top-level filter row.
- Search: collapse behind existing search affordance if space requires; search book, reference, numeric passage. Not theological topics (not present in data).
- Each row: two-digit index, reference only, single status indicator with text. Avoid bordered cards on each entry.
- Tapping opens selected passage in the Focus practice overlay, remembers return route.
- No default fake titles/categories or automatic importance labels; source JSON contains neither.
- A passage can be moved back into active learning without erasing its historical practice log.

**Status model:** catalog item `not_started` / `learning` / `memorized`. `due` is computed from `nextReviewOn`, not another exclusive status. Summaries and filters must reflect this distinction.

## 6. Learning and review behavior

- No automatic passage switch at local midnight. One active passage continues until the user chooses a new one.
- The daily queue chooses (a) oldest due review first, otherwise (b) active learning passage, otherwise (c) next unstarted passage by source order; max **one primary suggestion** on Write.
- Optional: show count of other due passages after entering the practice surface; avoid a punitive outstanding-task badge on Write.
- `recalled` increases review interval using **1 → 3 → 7 → 14 → 30 days**. `partial` and `forgot` set due next day; never delete previous progress or silently revoke memorized status.
- Manual `암송 완료로 표시` persists irrespective of review scheduling. Explicitly distinguish `학습했어요` from `암송했어요`.
- A user may practice several verses in one day; each practice attempt records its own date/time. No streak/no penalty/no daily quota.
- Returning to a memorized passage is a normal action; don't describe `forgot` as failure.

## 7. Data contract and safe persistence

Catalog source: `data/scripture/nlt-popular-100.json` from PR #66 with `entries[100]` containing id, order, reference, book, chapter, verse_start, verse_end. It is not currently in static public output. During integration, publish a **validated static asset** from that canonical catalog (e.g. `public/legacy/data/scripture-memory-100.json`), using a small deterministic script or explicit moving to public; no public fetch from GitHub at runtime.

Proposed local state under *new independent key* `kona.scripture-memory.v1` (not modifying existing app data):
```json
{
  "schema_version": 1,
  "active_passage_id": "philippians-4-6-7",
  "passages": {
    "philippians-4-6-7": {
      "status": "learning",
      "memorized_at": null,
      "last_practiced_at": "2026-11-13T19:00:00.000Z",
      "review_stage": 1,
      "next_review_on": "2026-11-14",
      "attempts": [
        {"at": "2026-11-13T19:00:00.000Z", "result": "recalled"}
      ]
    }
  }
}
```

- Dates: UTC timestamps for events + date-only due value based on app-local day/timezone. Do not use the arbitrary date picker selection when writing a practice record.
- Validate state on load; unknown passage IDs ignored safely, bad JSON recovers to empty *in memory* without overwriting old bytes until user action; no destructive migration.
- On save failure/quota: keep state in memory, show retry, never claim persistence; don't clear existing app storage.
- No cloud synchronization implied.
- Existing export/restore currently covers journal data; before production, extend backup in a **nondestructive versioned way** and test round-trip with synthetic records. App must not tell users scripture progress is backed up until verified.
- No copyrighted verse body, provider response, note contents, or user practice log is ever committed to GitHub.

## 8. Scripture text, rights, and offline behavior

- Content source identity **NLT**; textual content absent from PR #66. Do not create text by scraping DailyVerses.
- Before product integration: confirm written terms for a licensed API (e.g. official NLT API/API.Bible), including public web app use, attribution, rate limits, key security, caching/offline, translations, and commercial scope. A free endpoint alone is not permission to redistribute full text.
- If API requires a secret, use an approved protected server-side proxy (not embed secret in public JS); don't add dependency/service before approval.
- When text fails: show reference and source/open externally + retry; no false claim that NLT loaded. If offline and no authorized local text available, reference-only UI remains usable for navigation and saved progress.
- English UI text can be localized, but scripture words must remain unmodified. A future Korean translation must identify its own publisher and copyright; don't label it a word-for-word NLT translation.

## 9. Visual specification and responsive states

Reuse existing `--bg`, `--surface`, `--ink`, `--sub`, `--line`, `--solid`, `--devo`, `--hero-ink`, `--kona-ui-scale`; avoid new hardcoded bright accent palette. One content reading surface, no nested colorful cards. Typography: main screen title 18–20px, reference 13.5–14px, labels 11–12px, passage text 16px/1.6. Line widths constrained by existing `.app` max width 470px and 16px side padding. No whitespace that mimics fake cards.

- 320px: full-width controls, two-line book/reference wraps, no horizontal scrolling; sticky close does not overlap status bars.
- 390px: baseline mobile.
- 1024px: centered ≤470px reading column.
- light/dark: compute contrast ≥4.5:1 normal text and ≥3:1 essential focus/component edges; dark palette must not inherit unreadable forced colors from the legacy cascade.
- 200% zoom / 19px UI preference: text reflows, button accessible, no fixed-height clipping.
- target hit areas ≥44px, keyboard focus visible, `lang=ko/en` and control labels localized.
- `prefers-reduced-motion` supported; no required animation.

## 10. Empty, loading, errors

| Case | UI text/action | Persistence |
|---|---|---|
| First visit | `말씀 시작하기` → first passage | Create only when user starts |
| No text rights/provider yet | Reference + `본문 제공 준비 중` / source URL | No fake scripture body |
| Loading | `말씀을 불러오는 중…` | Do not reset practice |
| Offline/network failure | `본문을 불러오지 못했어요` + Retry / Open source | Keep catalog and local progress |
| Rate limited | Explain temporary limitation; external reading link | No repeated auto-retry storm |
| No due items | `오늘 복습할 말씀이 없어요` + Continue learning | No forced next verse |
| Zero search results | `일치하는 말씀이 없어요` + Clear filter | Keep search text |
| Local save failed | `연습 기록을 저장하지 못했어요` + Retry | Retain state in memory |
| All 100 memorized | `다시 읽거나 복습할 수 있어요` | Keep completed history |
| Archived/old date | Write scripture row hidden | No backdated attempts |

## 11. QA acceptance gates

1. Baseline current navigation, Review switch, timer, note and stored data verified first.
2. Validate catalog: exactly 100 unique IDs/references, 25 items per source page, valid verse ranges and ordering.
3. Write shows the single line after `#qc-v2` and opens the right passage from first, learning, due, practiced-today and archived-date states; Plan and Check-in remain unchanged.
4. Focus active timer stays intact on open/close; Pray and Focus unchanged; Devotion topic editing unchanged.
5. Self-check result saves once, survives reload, partial/forgot behavior correct, no completion without explicit action.
6. Review existing filters untouched; library search/filter handles all 100, even long book names.
7. Device-local save/restore and old notes round-trip; synthetic test data only, and restored progress match.
8. API success, no-rights, offline, 429, error states and source attribution.
9. 320×844, 390×844, 1024×844, light/dark; Korean/English; keyboard/Android Back/Escape; 200% text scaling; verify actual screenshots, not CSS assumptions.
10. Existing static checks, smoke, no horizontal overflow, no stray layout CSS or source changes.
11. No action on production `main`, Cloudflare, local real user data until separate approval.

## 12. Delivery boundaries

**Phase A (this work):** detailed product+UI plan and a sandboxed interactive stand-alone prototype using mock references; no production behavior/code change.  
**Phase B (after plan approval):** implement on isolated branch with data + licensed text integration; run QA in preview.  
**Phase C (only with separate authorization):** merge and deploy, with rollback commit and prior deployment recorded.

The prototype must use **in-memory only** demo state, no browser persistence, no API calls, no copyrighted NLT verse text. It is *not* the real app and not proof of production integration.

## 13. Navigation correction log (2026-11-13)

Previous proposal accidentally assumed that the four static `index.html` tab buttons were the live navigation. Confirmed runtime controller creates `#page-capture`, inserts a fifth Write tab (`data-page=capture`), and relabels `data-page=today` as **Plan**. The correct current structure is **Write / Check-in / Plan / Focus / Review**. Scripture cue belongs to Write, NOT Plan; other screens unchanged. Any UI mock must display five tabs. The authoritative pre-change app remains `main`; this isolated branch is never production.
