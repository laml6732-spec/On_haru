# On_HARU — Backup and restore guide

## Why this matters
On_HARU currently keeps personal records in the browser's local storage. They do not automatically follow a user to a different browser, device or website origin. Clearing browser/site data can erase the local copy. **The safest supported portable copy is a downloaded JSON backup.**

## Back up current records
1. Open **On_HARU → Review** and locate the backup controls (open the related settings/control area if collapsed).
2. Select **Back up now**.
3. Save the downloaded `.json` file somewhere **outside that browser's storage**, such as a secure device folder or private cloud drive.
4. Confirm the file exists and keep it private: it may contain sensitive personal notes, prayers, or reflections.
5. Repeat before changing devices, browsers, site addresses, or resetting the app, and periodically after important changes.

## Restore from a saved JSON file
1. **First back up anything already on the target browser**, so it can be recovered if the import goes wrong.
2. In On_HARU's **Review** backup controls, choose **Restore** and select your previously downloaded JSON file.
3. Read the confirmation carefully before accepting. **A restore may replace the target browser's existing records**; do not assume it merges safely.
4. Confirm, then check that recent notes, plans, sessions, and reflections appear correctly.
5. Keep the original JSON backup until all records have been checked.

## Before redesigns or data migrations (engineering requirement)
- Verify the exact current backup payload, restore semantics, validation and failure behavior in the latest source. This guide describes existing button paths but **does not certify every edge case**.
- Test the entire cycle with fabricated entries in isolated browser contexts: export → save file → import → confirm content and relevant settings.
- Protect against unsupported or malformed JSON, accidental overwrites, silent partial restores, and incompatible schema versions.
- For any change to storage format, key names, origins, or record model, first provide an export path, migration/compatibility check, and rollback strategy.
- Never test recovery by resetting the user's real browser storage or by uploading private backups to third-party testing tools.

## Current source references
- Review controls in `public/legacy/index.html`: `#backupNow`, `#restoreNow`, `#restoreFile`.
- Existing isolated backup/restore interaction in `scripts/ui-matrix.mjs`.
