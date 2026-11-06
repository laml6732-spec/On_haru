# On_HARU — Design Direction

## Three-line brief
**Purpose:** Help people organize their day, capture meaningful moments, pray, reflect, and revisit records effortlessly.
**Tone:** Quiet, warm, clear, personal, and thoughtfully restrained — a journal rather than an administrative dashboard.
**Memorable detail:** A gentle moment of capture, expressed through the existing listening-sheep idea or an equally strong, cohesive replacement.

## Product principles
1. **User benefit over legacy preservation.** The current screens, styles, and components can be redesigned or refactored. Keep only what continues to serve the user well.
2. **Records before controls.** Put meaningful entries, dates, and context ahead of toolbars, filters, or decorative containers.
3. **One visual priority at a time.** Headings, primary action, secondary actions, and metadata need a readable hierarchy.
4. **Calm without blandness.** Use thoughtful typography, intentional spacing, and a coherent accent. Avoid generic cards, loud gradients, and unnecessary borders.
5. **A consistent reflection model.** Daily, Weekly, Archive and Mood are different views of related records. Make date navigation and context understandable without forcing all views to look identical.
6. **Accessible and bilingual.** Design for Korean and English, light and dark themes, small screens, keyboard interactions, clear touch targets, and status signals that aren't color-only.
7. **Easy recovery.** Privacy-preserving browser-local records require a discoverable backup/restore path; keep it clear but visually subordinate to daily use.

## Current implementation is a starting point, not a contract
- Existing manifest accent is green (`#1D6155`), with an off-white background (`#FDFDFB`). Reuse established tokens when they fit; deliberately revise them if another coherent direction improves usability.
- Existing visual elements, including the sheep illustration, can be adjusted or replaced if quality, consistency, or accessibility improve.
- Changes to the visual design or information architecture are permitted. Explain the before/after user benefit.
- Changes to stored data require a separate compatibility and recovery plan, regardless of how much of the UI changes.

## Acceptance questions
- Can someone find the day's primary action or most important record immediately?
- Is it obvious what is tappable, selected, saved, empty, or unavailable?
- Does information stay understandable at 320px and in dark mode?
- Are Korean and English both natural and readable?
- Can users safely export and restore their data before changing devices/browsers?
