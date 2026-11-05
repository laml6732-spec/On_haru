# On_HARU — private, minimal install analytics

Tracking begins **only after** the telemetry script is deployed. Older installs can't be recovered from history. The same device can be counted twice if it uses both Cloudflare origins, another browser, or clears storage.

## What is collected

- The anonymous random UUID created on the current origin is hashed (SHA-256 + origin) in the Worker before storage.
- Only its hash, site label (`workers` or `pages`), visit date (UTC), and first/last-seen / installation-observed timestamps.
- Install is observed on supported browsers via `appinstalled`, or when the app starts in standalone mode. It is an **estimate of installed browser profiles**, not actual Play Store/App Store downloads.
- Today's visitors: browser profiles that loaded the site today; installed-app users are included.
- Today's installed-app opens: installed/standalone browser profiles that opened the app today.
- DNT and Global Privacy Control are respected.
- Personal notes, prayer/reflections, names, email addresses, exact IP addresses and note contents are not read by the client or stored in D1. No public read API is exposed.
- Tracking is best-effort and silently fails offline or when blocked.

## Private dashboard (Cloudflare account owner only)

Cloudflare Dashboard → Storage & databases → D1 → `onharu-metrics` → Console:

```sql
SELECT * FROM onharu_overview_utc;
```

| Field | Meaning |
| --- | --- |
| `devices_seen` | Total distinct anonymous profiles observed (across both sites; no cross-site dedup) |
| `installs_observed` | Profiles observed installed or opened standalone |
| `visitors_today` | UTC today unique visiting profiles |
| `installed_app_openers_today` | UTC today unique standalone opening profiles |

Breakdown by site:

```sql
SELECT site, COUNT(*) AS devices_seen,
       SUM(installed_at IS NOT NULL) AS installs_observed
FROM metric_devices GROUP BY site;
```

Last 14 days:

```sql
SELECT day_utc, site, COUNT(*) AS visitors
FROM metric_daily_visits
WHERE day_utc >= date('now','-13 days')
GROUP BY day_utc, site ORDER BY day_utc DESC, site;
```

The endpoint is at `https://onharu-metrics.laml6732.workers.dev/event`. It only accepts browser requests from the two known On_HARU origins with valid event types. These coarse statistics can be influenced by browser privacy controls, reinstalls, or spoofed requests. For production abuse prevention use edge rate limiting if necessary. The metric endpoint never returns a database read.

## Deployment

- Cloudflare D1 database: `onharu-metrics`, bound as `METRICS_DB` to the `onharu-metrics` Worker.
- Worker implementation: `cloudflare/onharu-metrics-worker.js`.
- Frontend: `public/legacy/runtime/install-metrics.v1.js`, loaded defer by `public/legacy/index.html`.
- Pages auto-deploys `main` to `on-haru-pages.pages.dev`; the existing `on-haru.laml6732.workers.dev` bridge proxies Pages without changing its URL, so both receive the exact same frontend update.
- Keep HTML's `kona-release` and SW's `RELEASE` in sync. Add the new JS file to SW's CORE list if offline caching is desired.
- The old `onharu.myeram.chatgpt.site` is not tracked, as it is a separate original.
