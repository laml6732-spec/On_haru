# Product Design Work-mode handoff — On_HARU reference-first audit

## Source of truth
Read this **first**, before judging layout or changing code:
`docs/ui-audit-2026-11/REFERENCE_FIRST_DESIGN_QA_STANDARD.md` on branch `audit/precision-visual-qa-2026-11-05`.

Current code target: `laml6732-spec/On_haru`; live origin: https://on-haru.laml6732.workers.dev/ . Preserve the live Worker routing, existing user origin, PWA installation scope, icon/splash design and localStorage schema. The reference doc distinguishes WCAG Level AA obligations, platform-specific recommendations and proposed On_HARU design tokens. Do not reclassify an advisory product choice as a WCAG failure.

## What standard chat already completed
1. Verified authoritative URLs for WCAG 2.2, Apple HIG, Android/Material touch guidance, IBM Carbon spacing.
2. Created reference hierarchy, product rubric, pass/fail measures, and explicit exceptions in `REFERENCE_FIRST_DESIGN_QA_STANDARD.md`.
3. Collected geometric evidence for 320/390/1024px × light/dark in a QA-only branch; 48/48 baseline structural checks previously passed, which is **not** a guarantee of visual polish.
4. Logged actual measurements and identified candidate issues: [#9](https://github.com/laml6732-spec/On_haru/issues/9), [#11](https://github.com/laml6732-spec/On_haru/issues/11), [#8](https://github.com/laml6732-spec/On_haru/issues/8), [#7](https://github.com/laml6732-spec/On_haru/issues/7).

## Product Design visual audit — do in this order

### Phase A: read-only capture and visual review
1. Preflight official standard references and On_HARU record semantics. No CSS edits yet.
2. Capture and visually inspect **actual** 320/390/1024 screenshots in light/dark, both English and Korean where wrapping changes. For every capture, confirm the intended screen has loaded, selected tab and state are correct. Use **synthetic** data in isolated browser contexts; never seed or reset the user's actual production browser.
3. Screens/states: launch/language choice, Write empty/long-note/emoji expanded and selected sheep, Check-in sliders and class response, Plan schedule/task/shortname collapsed, Focus timer start/paused/finished, Review Daily/Weekly/Archive Records/Archive Mood, Settings with modal/keyboard. Do not substitute synthetic screenshots for personal data, and do not alter real notes.
4. Inspect visual and semantic hierarchy: keep Plan child notes under their event, Personal Note separate, Prayer/Devotion/Focus as short session log, Check-in as state/mood, Class Review fields and one timestamp.
5. Mark each item as **Verified failure**, **Usability candidate**, **Intentional difference**, or **Not verified**. Cite the reference criterion and screenshot filename for every item.

### Phase B: precise audit output (before any implementation)
Produce a table with columns:
`Screen / State | Screenshot ref | Actual measured geometry/style | Source + rule | Normative or recommendation | Severity P0–P3 | Proposed change | Risk to adjacent components`.
Highlight optical alignment, type hierarchy, spacing token deviations and contrast/focus checks separately. A 2px indentation is not an issue if it reflects nesting; a 10px font is not inherently WCAG-noncompliant.

### Phase C: only after Phase B
Prepare minimal CSS-only fixes, by component family, on a fresh GitHub branch. Before/after screenshot at identical states and viewport widths; validate in both themes and languages, then run existing smoke/matrix/extra/PWA tests. Do not merge into main or deploy without explicit request.

## Work handoff acceptance
- Screen-by-screen accepted screenshots (and annotated issues if needed).
- Relevant WCAG criteria checked with measured data; any exemptions documented.
- A consistent, On_HARU-specific design token proposal **approved against real appearance**, not simply imposed from Carbon.
- Prioritized, small list of actionable fixes with reproduction details.
- No unverifiable 'consultant quality passed' conclusion; call out untested cases and optical judgment limits.
