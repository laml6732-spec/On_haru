# On_HARU — Reference-first UI/UX Quality Standard v1.0

**Status:** Standards and acceptance criteria defined **before** any UI changes. This document is the QA specification, not a claim of accessibility certification.  
**Product:** On_HARU PWA — Write, Today/Plan, Check-in, Focus, Review Daily/Weekly/Archive Mood, Settings.  
**Production URL:** https://on-haru.laml6732.workers.dev/  
**Baseline main commit:** `707503375a5860755700c00c7485f271d71610bf`; release `metricsmoodv120261105` (verified 2026-11-05).  
**Rules of engagement:** Leave localStorage schema, private notes, Plan-link relations, PWA origin and automatic deploy configuration untouched during QA. This is **reference-first**, not “redesign-by-guessing”.

## 1. Source hierarchy and authority

| Priority | Source | Normative vs recommendation | On_HARU use |
| --- | --- | --- | --- |
| A | **W3C WCAG 2.2 Level AA** (web content) | Normative criteria; exemptions matter | Functional accessibility, minimum pointer targets, color contrast, reflow, focus visibility |
| B | **Apple Human Interface Guidelines — Accessibility** | Platform-specific design guidance, **not** WCAG | Touch comfort and native-like visual affordances for iOS PWA |
| B | **Android accessibility guidance / Material** | Platform-specific design recommendation, **not** WCAG | Touch comfort / padding around visually small icons on Android |
| C | **IBM Carbon — spacing foundation** | Reference design system, **not** an On_HARU requirement until adopted | Vocabulary for consistent spacing tokens and rhythm |
| D | **On_HARU approved IA and existing visual language** | Product-specific design constraints | Gentle muted aesthetic, plain surfaces instead of excessive cards; distinct Plan-linked / Personal / Focus / Check-in / Class Review presentation |

**Do not claim** that a 44px/48px target is required by WCAG 2.2 AA. CSS px, iOS pt and Android dp are different units and should not be conflated. Evaluate the web actual pointer target in **CSS px**, using browser geometry and testing interaction. The On_HARU comfort target below is a product decision, not a standard violation threshold.

## 2. Verified primary reference URLs

1. W3C WCAG 2.2 §2.5.8 Target Size (Minimum), Level AA: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
   - 24×24 CSS px for pointer targets **or listed exceptions**, including adequate spacing. Rounded/clipped target shape and actual clickable area matter.
2. W3C §1.4.3 Contrast (Minimum), Level AA: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
   - Normal text >=4.5:1. Large-scale text >=3:1. Inactive/decoration/logo exceptions. 14pt bold ≈18.5 CSS px; 18pt regular ≈24 CSS px for relevant large-text definition.
3. W3C §1.4.11 Non-text Contrast, Level AA: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast
   - Necessary UI component boundaries, selected states and meaningful graphical information >=3:1 against relevant adjacent color(s). Decorative artwork does not automatically carry the same requirement.
4. W3C §1.4.10 Reflow, Level AA: https://www.w3.org/WAI/WCAG22/Understanding/reflow
   - Vertically scrolling content supports 320 CSS px equivalent width (e.g. 1280px at 400% zoom) without two-dimensional scrolling or losing information/functionality, except inherently two-dimensional layouts.
5. W3C §2.4.11 Focus Not Obscured (Minimum), Level AA: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
   - Keyboard-focused components must not be **entirely hidden** by author-created overlays, e.g. fixed bottom tab bar. Visible focus indication is also separately required.
6. Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
   - iOS/iPadOS minimum hit-region guidance: 44×44 pt. Spacing around neighboring controls matters.
7. Android Developers — Make apps more accessible (Views): https://developer.android.com/guide/topics/ui/accessibility/views/apps-views
   - Recommends focusable/touch region >=48×48 dp. The visible glyph may be smaller than its click region.
8. Android Accessibility Help — Touch target size: https://support.google.com/accessibility/android/answer/7101858
   - 48×48 dp plus typical 8dp spacing recommendation; do not blindly impose dp on browser CSS.
9. IBM Carbon — Spacing foundation: https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview
   - Tokens include 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160px, expressed as a reference scale.

**Reference review date:** 2026-11-05. Check URLs and content again before long-term reuse.

## 3. On_HARU v1 proposed product rubric (explicitly *not* universal standards)

| Test ID | Criterion | Pass / evaluation procedure | Authority |
| --- | --- | --- | --- |
| A11Y-TARGET | Touch activation area | Verify browser-visible effective pointer target >=24×24 CSS px **or evaluate each WCAG exception**; verify that 24×24 rectangle truly fits clipped shape | **WCAG AA** |
| USAB-TOUCH | Critical mobile controls | **Product target ~44×44 CSS px** when feasible for icon-only/navigation controls, or documented safe equivalent target; do not reduce adjacent controls' effective area; real tap test needed | **On_HARU comfort target** inspired by Apple 44pt / Android 48dp; NOT a conformance threshold |
| A11Y-CONTRAST-TEXT | Normal text | >=4.5:1 measured on actual rendered background (include overlays, transparency, gradients); large text per spec >=3:1 | **WCAG AA** |
| A11Y-CONTRAST-UI | UI states/icons | >=3:1 for visuals required to identify enabled controls / selected state; identify decorative exceptions explicitly | **WCAG AA** |
| A11Y-REFLOW | Narrow layout | At CSS width 320px (and independently at 1280px browser with 400% zoom), **no essential lost text or functionality**; horizontal scrolling only for genuine 2D data if unavoidable | **WCAG AA** |
| A11Y-FOCUS | Sticky dock and modal | Keyboard tabbing does not **fully hide** focused elements behind dock; visible focus and modal focus/escape are separately tested | **WCAG AA** |
| RHYTHM-SPACING | Visual rhythm | Default design tokens: **2,4,8,12,16,24,32px** for new spacing; exceptions permitted for nested parents (e.g. Review internal 2px inset) and optical alignment; do not force every x-coordinate identical | **On_HARU product token proposal** based on Carbon |
| TYPE-SCALE | Hierarchy | **Body ~14–16px**, section 14–17px depending context, support labels 11–13px, explanatory microcopy **>=12px target**. Real content contrast and zoom still required. No universal WCAG minimum font size. | **On_HARU product choice**; needs visual approval |
| GRID-ALIGN | Alignment | Compare x/y bounding boxes of items **only within the same semantic tier**. For the same component, preferred <=2 CSS px misalignment after accounting for intentional padding/rails; no arbitrary re-indenting of nested Plan notes | **On_HARU product test tolerance**, not WCAG |
| OPTICAL | Perceived alignment | Actual screenshots inspect icon optical weight, the left rail, cropped emoji edges, PWA app icon against dark/light launcher backgrounds. Geometric equality alone does not pass | **Professional visual review** |
| COMPONENT | Same meaning → same treatment | Chip label, button affordance, selected/unselected state and time styling consistent **within a component category**, not across all record types | **On_HARU product** |
| DATA-SEMANTICS | Preserve record hierarchy | Plan-linked notes nested under parent; Personal Notes independent; Focus/Prayer/Devotion short activity logs; Morning/Evening Check-ins distinct; Class Review fields grouped, timestamp once | **On_HARU product-specific invariant** |
| COLOR-STATE | Meaning not color alone | Mood colors additionally identify Morning/Evening and readable labels; no rating / energy-only distinguished; do not infer mood scores or causation from sessions | **Product invariant + accessibility consideration** |
| PWA-INSTALL | Icon / launch | Test manifest icon, transparency and actual launcher appearances in light/dark; avoid a square black or opaque patch unexpectedly, avoid touching main splash without evidence | **Product acceptance test** |

**Unapproved choices:** Token scale / 12px microcopy / <=2px alignment / ~44 CSS px are *proposed product standards*. Verify compatibility with brand and current content before implementing; they are not grounds to label existing code WCAG-noncompliant.

## 4. Baseline findings mapped to criterion (from 2026-11-05 production)

| Screen / selector | Actual measurement or observation | Rubric | Status / priority | What *must* be tested before fix |
| --- | --- | --- | --- | --- |
| Write `.kona-tag-tray-toggle` | 28×36 CSS px at 320px | A11Y-TARGET/USAB-TOUCH | **WCAG target-size alone passes** by bounds; **comfort gap P2** | Expand hit area without overlapping sheep/neighbor chip; tap both at 320px |
| Plan `#konaScheduleMore` | 32×32 CSS px | A11Y-TARGET/USAB-TOUCH | **WCAG target-size alone passes**; **comfort gap P2** | 320px safe-area and header alignment |
| Write sheep chip | 40×36 CSS px, icon 34×34 | OPTICAL, A11Y-CONTRAST-UI *if essential* | **P2 visual risk** (too pale relative to neighbors) | Determine whether icon itself is functional/essential or decorative; inspect selected state |
| Check-in `#checkRecordedTime` | 132×38 CSS px | USAB-TOUCH | **Comfort gap P3**; native control exception may apply only if unmodified | On-device time picker tap / screen reader label |
| Mood day | 40×43 CSS px | USAB-TOUCH | **Comfort gap P3**; WCAG size passes | At 320px 7 columns, ensure larger target doesn't overlap adjacent days |
| Mood weekday and legend | font 10px; legend at 320px wraps | TYPE-SCALE, A11Y-CONTRAST-TEXT | **P2 legibility**; **contrast pass/fail not yet measured** | Sample actual contrast in light+dark; text zoom to 200% |
| Bottom tab label (example Plan) | font 9.5px at 320px | TYPE-SCALE | **P2/P3 legibility**; no automatic WCAG failure | Visual prominence and label truncation, Korean, font scaling |
| Focus timer | X=68.6px, width=182.9px at 320px; center≈160.05px | GRID-ALIGN | **PASS**, preserve alignment | Check 390/1024 and long timer digits |
| Plan / Check-in / Focus page left | x≈12px at 320px; Archive inner x≈14px (= nested inset) | GRID-ALIGN | **Intentional nesting, not a 2px defect** | Compare only same-tier components |
| Review Daily | 5 record types, one Class Review time in synthetic tests | DATA-SEMANTICS | **PASS by prior automated tests** | Manual optical hierarchy and stress with long notes |
| PWA watercolor icons | corner RGBA (0,0,0,0) | PWA-INSTALL | **P2** known CI fail; NOT necessarily a dark pixel in image | Actual installed launcher on Android/iOS |

**Previously reported GitHub problems:** [#7 release-header CI contract](https://github.com/laml6732-spec/On_haru/issues/7), [#8 PWA icon alpha](https://github.com/laml6732-spec/On_haru/issues/8), [#9 sheep/legend](https://github.com/laml6732-spec/On_haru/issues/9), [#11 touch targets](https://github.com/laml6732-spec/On_haru/issues/11).

## 5. Sequential acceptance gates (run in this order)

1. **Gate 0 — confirm sources and product semantics:** The above links are still authoritative; document any disagreement between WCAG / platform guidance / On_HARU decisions.
2. **Gate 1 — freeze baseline:** Capture read-only, isolated (non-user) screenshots and DOM geometry for Write, Plan, Check-in, Focus, Review Daily/Weekly, Archive Records/Mood, Settings. Record locale and theme.
3. **Gate 2 — standard-by-standard measurements:** Pointer targets (24px exceptions), computed text contrast, UI-state contrast, 320 reflow and zoom, focus visibility, then product spacing grid and typographic role groups.
4. **Gate 3 — Product Design visual audit:** Human visual review of the accepted screenshots, record alignment/optical/semantic issues with screenshot evidence. Score P0 (data loss), P1 (functional/accessibility failure), P2 (legibility/touch/strong visual issue), P3 (polish).
5. **Gate 4 — minimum safe change:** Fix one independent component family at a time on a GitHub feature branch. Never reflow all Review records as one card style. No user-data edits.
6. **Gate 5 — before/after evidence:** Same device sizes and fixtures, light/dark (and Korean/English for long text). Verify no regressions in existing 90/90 QA matrix, archived notes, timers, PWA icons and installed app scope.
7. **Gate 6 — release:** Merge to main only after verified branch QA and explicit approval. Cloudflare Pages / Worker origin remain unchanged.

## 6. Work / Product Design handoff

**What is already done in regular chat:** Research / verify references; define test hierarchy, product metrics and baseline; create GitHub QA report and automated geometry collector; preserve production unchanged.

**What Product Design in Work must do:** Capture and *actually inspect* the screenshots one-by-one, including empty/populated/expanded states and Korean/English text; audit optical alignment/visual density against this standard; annotate evidence; rank screen-specific fixes; propose restrained before/after variants; visually verify code changes on a preview URL if asked.

Product Design must not treat 90/90 functional QA or 48/48 geometry QA as proof of professional visual quality. It must not infer the user's real private records from synthetic screenshots.

## 7. Evidence links

- [Precision geometry and screenshots CI run](https://github.com/laml6732-spec/On_haru/actions/runs/42089509852)
- [Expanded detail run](https://github.com/laml6732-spec/On_haru/actions/runs/42089870919)
- [Prior tab QA PR #10](https://github.com/laml6732-spec/On_haru/pull/10)
- [Precision visual audit PR #12](https://github.com/laml6732-spec/On_haru/pull/12)

**Version 1.0:** No new production UI modifications authorized by this reference document.
