# On_HARU — DESIGN.md
> Status: design baseline; Review redesign under proposal in docs/REVIEW_UX_PLAN.md · 2026-11-06 (Hawaii) · main `8060aea9` (app source `ac999bc5`)
> Scope: existing bilingual, offline-first PWA; design specification, not an instruction to rebuild or deploy.

## 0. Source of truth and non-negotiables
- Describe the **rendered runtime UI**, not only the original HTML: JavaScript creates/rearranges navigation and Review views.
- Protect user-created records, storage schema/keys, save semantics, JSON backup/restore, PWA install/offline/update behavior and the original legacy site; presentation/navigation may change through the reviewed Review plan.
- No new screen, feature, library, data migration, or general CSS rewrite is implied by this document.
- Use existing CSS variables and component styles first; where a rule conflicts with the actual UI, record a small targeted change and verify it before implementation.
- This document governs UI consistency; the user-supplied AGENTS instructions govern implementation/rollback, and `docs/WORK_UI_HANDOFF.md` remains historical QA context rather than visual authority.

## 1. Product map and content-first hierarchy
- Live bottom navigation: **Write · Check-in · Plan · Focus · Review**; maintain order, familiar icons, labels, and one active destination.
- Settings opens from the header gear; do not introduce a sixth bottom tab.
- Current Review baseline: **Daily · Weekly · Archive**, with **Records · Mood** under Archive. This describes existing UI, not a permanent navigation constraint; see the Review proposal.
- Keep one Type filter for **Schedule-linked / Prayer · Focus · Devotion / Unlinked notes**. Classification must not force repeated headings above every record; presentation may be simplified without changing record types.
- Each view has one primary reading/doing objective: Write=create, Check-in=record, Plan=see/manage, Focus=run session, Review=read/find/reflect.
- Hierarchy: main content or key result → date/context → relevant action → filter/secondary metadata. Avoid equal visual weight for everything.
- Within Review records: daypart/date → event or semantic group → record title/content → timestamp, tags, counts, and tools.
- Keep controls adjacent to the information they affect; move infrequent options behind existing More/Details, not extra permanent toolbars.

## 2. Selective surfaces and cards
- Prefer whitespace, type, and thin separators for lists and adjacent information; do not put every row inside a separate elevated card.
- Reserve a card/surface for actionable input, a meaningful grouped summary, active state, or content requiring visual separation.
- Avoid nested cards, multiple outlines, strong shadows, and redundant section labels; keep existing corner-radius tokens (`--radius-s`, `--radius-m`) where applicable.
- Light and dark surfaces use `--bg`, `--surface`, `--line`; never assume a white card in dark mode.
- Critical tools and data must remain readable when a card is removed; a border is not the only way to convey grouping.

## 3. Primary and secondary actions
- Exactly one visually dominant action within the **current decision context**, not necessarily one per screen; a screen may have no primary CTA while browsing.
- Primary = commit/advance the main task (Save note, Start, Check in for this day); secondary = edit, change, navigate, filter, cancel.
- Use existing `--solid` / `--hero-ink` for primary contrast; text/outline for secondary; danger styling only for destructive actions.
- Prevent two adjacent controls from looking simultaneously primary. Do not use a filled button merely because it is available.
- Selected segmented controls are distinct from CTAs: one active segment with explicit `aria-pressed`/state and a readable label.
- Disabled and busy actions explain why or show progress; never imply a save or deletion has completed early.

## 4. Compact lists, readable records
- Keep user-written titles distinct from body text; omit an identical event title already shown by its parent, without changing stored text.
- List rows are compact: clear title/preview first, then one concise metadata line; suppress repetition when the parent date or event already supplies context.
- Long record bodies preserve line breaks, natural wrapping, and paragraphs. Do not apply list-density rules to expanded reading text.
- Use `--type-title`, `--type-body`, `--type-label`, `--type-meta`, `--reading-size`, and `--kona-ui-scale` before new pixel values.
- Baseline typography is Pretendard/system UI; handwriting/brand faces are reserved for existing branded treatments, not record bodies.
- Expanded reading text targets **15–16 CSS px** at default size with line-height **1.5–1.65**; scale through existing reading tokens/preferences. This is a target, not current compliance.
- Compact previews may retain the existing 13.5px base; do not use the observed 1.225 line-height for expanded paragraphs.
- Preview truncation needs a visible and operable expand/open path; titles and user-entered text must not be silently lost.
- Preserve useful two-line day/context summaries where already present; do not sacrifice record visibility to oversized filters or empty framing.

## 5. Green-neutral palette and semantic accents
- Reuse `--bg`, `--surface`, `--ink`, `--sub`, `--line`, `--hero-ink`, `--solid`, `--soft`, `--pray`, and `--devo` rather than adding parallel token names.
- Green = app identity/positive selection; neutrals = structure/text; pink/blue or existing event-category colors = specific meaning only.
- Dark mode uses its own existing `html[data-appearance=dark]` tokens; do not apply washed-out light pastels unchanged to dark backgrounds.
- Monthly Mood uses the existing 5×5 theme-aware color mapping for mood × energy; retain all four recorded phases and their shape legend.
- The default 7-day graph uses **End-of-day only**, with separate Mood/Energy lines, distinct strokes/shapes, a 1–5 axis, date labels, and accessible score text; preserve missing-data gaps.
- Never encode mood, time of day, status, priority, or validation by color alone: pair with a word, shape, symbol, or state label.
- Avoid decoration that competes with records. Existing ocean/wave and sheep visuals remain intentional brand exceptions.

## 6. Selection, confirmation, and disclosure
- **Selection among several options:** existing sheet/choice UI. **Consequential confirmation:** focused dialog with explicit action and cancel.
- **Brief optional settings:** inline `details`/expander; use an understandable label, chevron, and `aria-expanded` when appropriate.
- Destructive reset/restore/delete actions require clear consequences; irreversible reset keeps its extra typed confirmation and backup route.
- Never substitute browser-native `alert`/`prompt`/`confirm` for the app's visual and keyboard-consistent patterns.
- Modal overlays must be topmost, scrollable on short screens, focus-managed, Escape/Back dismissible where safe, and restore focus on close.
- A sheet is not a reason to hide the currently edited data or erase an unsaved draft.

## 7. Icons, labels, and states
- Icons support the text/action meaning and are not substitutes for accessible names; icon-only controls require localized `aria-label`.
- Use one consistent style family for navigation, arrows, edit, more, close, and disclosure; reserve emoji for user expression and established brand semantics.
- Do not create duplicate selected indicators (e.g., heavy border + fill + check + shadow) where a single clear treatment suffices.
- Active tabs, selected mood/emoji, checkboxes, pinned items, and disabled states remain recognizable in grayscale and dark mode.
- Keep displayed time-of-day terminology consistent across Check-in, Review, Mood legend, and saved records (Morning / Midday / Evening / End-of-day).

## 8. Navigation, date movement, and continuity
- Maintain the existing five-tab bottom dock and header settings; the dock must not obscure the final row or a modal action.
- Use the same visual grammar for previous/next arrows, period label, current-day shortcut, and selected state.
- Daily moves by day; Weekly by week; Archive Records supports date-grouped browse/search; Archive Mood moves by 7-day range or month.
- Keep access to existing 7-day End-of-day trends and full-month history. Their placement may change in Review; do not add data, inferred scores or duplicate destinations.
- Period labels must be legible before controls; filters are secondary to records and collapse when the view benefits from it.
- Switching tab, date, theme, or language must not unexpectedly discard unsaved input or alter a different day's data.
- Show the current date/context whenever a write or edit could otherwise be attributed to the wrong day.

## 9. Save models and feedback
- **Explicit save:** Write notes, event/task edits, record edit dialogs, and other actions with a visible Save/Finish affordance.
- **Auto-save:** check-in notes, mood/energy changes, day/weekly reflections and existing continuously saved fields; retain the actual per-field behavior.
- Write draft persistence is separate from explicit record creation; distinguish Draft saved from Saved note in text and assistive announcements.
- Feedback distinguishes Ready / Saving / Saved / Failed (localized); no success state until persistence succeeds.
- Use quiet inline feedback near the edited field (`role=status` / `aria-live=polite`), with a toast only when context or action warrants it.
- Preserve typed values and a retry path on storage failure, including quota/permission errors. Never clear data to recover from an error.
- Explain browser/device-local storage. Records JSON and device-settings JSON are separate; the latter holds language/display preferences. State replacement consequences accurately; never imply cloud sync.

## 10. Empty, loading, and error states
- Empty state = one plain-language explanation plus **one relevant next action**, or no action if the screen is informational.
- A first-time empty day differs from zero search results: the latter suggests clearing/modifying current filters.
- Mood empty date may offer Check-in and a quiet link to the latest recorded mood, as the current UI already does.
- Prefer content skeletons only for real waiting; local instant transitions should not flash ornamental spinners.
- Errors identify the failed operation and the next safe step; preserve unsaved values and accessible focus.
- Keep status messages concise, located in context, and translated; never represent network/offline status as loss of local data.

## 11. Responsive, accessibility, and bilingual behavior
- Mobile-first; verify **320×844, 390×844, and 1024×844** in light/dark, with empty and representative populated records.
- No horizontal page scrolling, clipped text/actions, overlapping sheet/dock, unusable keyboard, or hidden confirmation at 320px.
- Desktop keeps readable line length and the current focused app layout; do not stretch note paragraphs across the entire viewport.
- Standard interactive hit targets should be **at least 44×44 CSS px**; compact calendar cells may use a documented exception with adequate separation and a larger accessible alternative.
- Meet WCAG AA targets: normal text **4.5:1**, large text **3:1**, essential component boundaries/focus indicators **3:1**; measure the final composited background, including opacity and inherited colors.
- Check enabled helper text, autosave/draft status and disclosure labels in dark mode; passing note-body contrast does not validate these elements.
- Semantic headings/labels, logical keyboard order, visible `:focus-visible`, dialog focus/return, and a reduced-motion path are required.
- Text scaling/user size preferences must work without content loss; avoid fixed-height text containers when Korean or enlarged type wraps.
- `lang`, dates, accessible names, placeholders, errors, help and singular/plural counts follow English/Korean setting; avoid mixed phrases such as Korean labels ending in English “tag”.
- User-authored notes/titles remain unchanged across language changes; approved default schedule labels may be localized without rewriting stored user text.
- Offline font fallback is required; remote webfonts must not block first paint or render the PWA unusable offline.

## 12. Screen exceptions and risk-based QA
- **Write:** expressive emoji/sheep capture tags and one-row More stay compact; selected state stays clear without ornamental rings on every item.
- **Check-in:** retain the current Morning / Class review / Evening entry UI; preserve legacy Midday and Daily End-of-day records in their existing paths. Do not add a fourth Check-in tab.
- **Plan:** existing schedule, task, day-summary, and recurring edit flows remain; long event names and short-name disclosure must survive edits.
- **Focus:** ocean/immersive timer may depart from list density, but Start/Pause/Finish, notes, and prayer choices remain usable in both themes.
- **Review Daily/Weekly:** writing is calmer and roomier than Archive results; groups, dates, related notes, and edit actions have distinct weight.
- **Archive Records:** compact search/filter controls, date headers and three semantic groups; retain ☆/★ Saved for later toggle and its selected state using current record flags.
- **Mood:** expose mood with a five-level line-face SVG plus text/value; energy uses its own label/value, not the face. This is proposed presentation, not a shipped feature. Keep all recorded phases accessible.
- **Settings/tutorial:** language/theme/text scale, backup/restore/help, familiar launch/sheep artwork, and safe reset are protected.
- **High risk:** backup/restore/reset, storage schema, recurring edits, focus timers, PWA cache/release, and modal focus require functional regression and rollback evidence.
- **Medium risk:** navigation/date boundaries, selected states, responsive overflow, i18n, contrast, dark theme require viewport/theme screenshots and interactions.
- **Low risk:** spacing, shadows, minor icons may use focused screenshot/DOM checks; do not run a full rewrite for a one-rule fix.
- QA order: baseline capture → smallest scoped change → static + relevant browser tests → before/after screenshots → human review → decision.
- Check the actual **rendered DOM and computed styles**, because runtime JS rewrites static HTML and legacy CSS has many competing `!important` rules.
- Never call uninspected screenshots, untested devices, or automated green checks “visually verified”; document exact covered sizes, states, and exceptions.
- On any failed high-risk regression, stop the change, restore the previous verified version, and keep production unchanged pending approval.

## Implementation guardrail
- Main files: `public/legacy/index.html`, `app.7cb1b71d4eb6.css`, `review-hierarchy.v1.css`, `runtime/legacy-controllers.9a6fbb5e22cc.js`, `runtime/settings.58b48f87b05a.js`, `sw.js`.
- Avoid global selector cleanup; use component-scoped changes with measured CSS specificity and regression evidence.
- For any later release, keep HTML/CSS/JS revision references and service-worker release/cache marker in sync. Current authorization covers GitHub documentation and Review planning only; app implementation/merge/deployment remain a later step.

## Verification status and known gaps
- Reused screenshots: app source `ac999bc5`, 320/390/1024 × light/dark; Write expanded tags, Check-in time, Focus presets, Weekly, Archive collapsed/filtered, monthly Mood (42 images reviewed).
- Reused passing CI: Review hierarchy `42317142713`, Check-in/Archive touch `42317142778`, Capture grid `42317142816`; main `8060aea9` changes evidence only after the app source commit.
- Additional live inspection: release `moodtrendv120261106`, 1363×936 viewport / 470px app; English light/dark and Korean dark samples, saved note retained after settings reload.
- New local static checks: 16/16. Fresh local browser execution failed at Chromium startup (`socket: Operation not permitted`); no new 6-viewport execution is claimed.
- Open: dense 13.5px / 1.225 Review text; faint dark Check-in helper/status and Write draft status; desktop targets below 44px; mixed Korean accessible names and “1 records”.
- Pending: full Korean viewport matrix, measured contrast of all enabled labels, 200% zoom/reflow, mobile keyboard, screen-reader/dialog focus and installed-device PWA checks. Existing passing CI is not a full accessibility sign-off.
