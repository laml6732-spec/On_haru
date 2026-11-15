# NLT Popular 100 — Scripture references

This is a **reference catalog**, not a database of NLT verse text. It contains 100 unique passages listed on the four pages of DailyVerses.net's *100 Most Popular Bible Verses* (NLT) as inspected on 2026-11-13. The site's popularity order can change.

- File: `nlt-popular-100.json`
- Translation for source links: **New Living Translation (NLT)**
- Data fields: stable passage ID, list order, English reference, book, chapter, starting/ending verse, and originating source page.
- No scripture wording is copied or stored. `text_included` is `false`.
- Source: https://dailyverses.net/top-100-bible-verses/nlt (pages 1–4).
- NLT copyright / permissions: https://www.tyndale.com/permissions

## Usage

Import `entries` into a future On_HARU scripture-memory feature. To display NLT wording inside the app, obtain appropriate permission or integrate a provider under its actual terms. Do not replace this reference file with scraped NLT passages.

## Safety

This is a seed catalog in the repository only. It does not change the app, browser storage, Cloudflare D1, or production data. No code imports this file yet.

## Verification

- Exactly 100 entries, numbered 1–100.
- No duplicate references or IDs.
- All chapters and verse ranges parse; `verse_end >= verse_start`.
- `source_page` is 1–4, 25 entries per page.
