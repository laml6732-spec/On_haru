-- Additive migration: preserve every existing visitor row and the legacy overview.
-- Apply BEFORE deploying the metrics Worker that accepts 'exclude' events.

CREATE TABLE IF NOT EXISTS metric_excluded_devices (
  site TEXT NOT NULL,
  device_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('developer', 'qa')),
  excluded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (site, device_id)
);

-- The "confirmed" exclusion view removes only explicit registrations.
-- Older suspected QA visits remain unmodified and are NOT silently excluded.
CREATE VIEW IF NOT EXISTS onharu_nonexcluded_overview_utc AS
SELECT
  (SELECT COUNT(*) FROM metric_devices d
     WHERE NOT EXISTS (SELECT 1 FROM metric_excluded_devices e
       WHERE e.site=d.site AND e.device_id=d.device_id)) AS devices_seen,
  (SELECT COUNT(*) FROM metric_devices d
     WHERE d.installed_at IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM metric_excluded_devices e
       WHERE e.site=d.site AND e.device_id=d.device_id)) AS installs_observed,
  (SELECT COUNT(*) FROM metric_daily_visits v
     WHERE v.day_utc=date('now') AND NOT EXISTS (
       SELECT 1 FROM metric_excluded_devices e
       WHERE e.site=v.site AND e.device_id=v.device_id)) AS visitors_today,
  (SELECT COUNT(*) FROM metric_daily_installed_opens v
     WHERE v.day_utc=date('now') AND NOT EXISTS (
       SELECT 1 FROM metric_excluded_devices e
       WHERE e.site=v.site AND e.device_id=v.device_id)) AS installed_app_openers_today;

-- Keep historical burst evidence distinct from verified exclusions.
-- These labels are heuristic; they do not prove who used the app.
CREATE VIEW IF NOT EXISTS onharu_device_segments_utc AS
SELECT d.site, d.device_id, d.first_seen_at,
  CASE
    WHEN e.reason = 'developer' THEN 'developer_confirmed'
    WHEN e.reason = 'qa' THEN 'qa_confirmed'
    WHEN m.new_ids >= 6 THEN 'qa_suspected_high'
    WHEN m.new_ids >= 3 THEN 'qa_suspected'
    ELSE 'unclassified'
  END AS segment
FROM metric_devices d
LEFT JOIN metric_excluded_devices e
  ON e.site=d.site AND e.device_id=d.device_id
LEFT JOIN (
  SELECT site, substr(first_seen_at, 1, 16) AS minute_utc,
         COUNT(*) AS new_ids
  FROM metric_devices
  GROUP BY site, substr(first_seen_at, 1, 16)
) m
  ON m.site=d.site AND m.minute_utc=substr(d.first_seen_at, 1, 16);
