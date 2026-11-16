"""Offline regression tests for the additive On_HARU metrics migration."""
from pathlib import Path
import sqlite3

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE metric_devices (
 site TEXT NOT NULL, device_id TEXT NOT NULL, first_seen_at TEXT,
 last_seen_at TEXT, installed_at TEXT, PRIMARY KEY(site, device_id)
);
CREATE TABLE metric_daily_visits (
 day_utc TEXT NOT NULL, site TEXT NOT NULL, device_id TEXT NOT NULL,
 standalone INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day_utc, site, device_id)
);
CREATE TABLE metric_daily_installed_opens (
 day_utc TEXT NOT NULL, site TEXT NOT NULL, device_id TEXT NOT NULL,
 PRIMARY KEY(day_utc, site, device_id)
);
CREATE VIEW onharu_overview_utc AS
 SELECT COUNT(*) AS devices_seen FROM metric_devices;
""")
day = db.execute("SELECT date('now')").fetchone()[0]
devices = [
    ("dev", "2026-11-15 00:01:00", "2026-11-15 00:02:00"),
    ("public", "2026-11-15 00:02:00", None),
]
devices += [(f"qa{i}", "2026-11-15 00:03:00", None) for i in range(6)]
devices += [(f"maybe{i}", "2026-11-15 00:04:00", None) for i in range(3)]
db.executemany(
    "INSERT INTO metric_devices VALUES ('workers',?,?,?,?)",
    [(id_, first, first, installed) for id_, first, installed in devices],
)
db.executemany(
    "INSERT INTO metric_daily_visits VALUES (?, 'workers', ?, 0)",
    [(day, row[0]) for row in devices],
)
db.execute(
    "INSERT INTO metric_daily_installed_opens VALUES (?, 'workers', 'dev')",
    (day,),
)
raw_sql = db.execute(
    "SELECT sql FROM sqlite_master WHERE name='onharu_overview_utc'"
).fetchone()[0]
migration = Path("cloudflare/metrics-segmentation.sql").read_text()
db.executescript(migration)
db.executescript(migration)  # Safe to re-run.
assert db.execute("SELECT devices_seen FROM onharu_overview_utc").fetchone()[0] == 11
assert db.execute(
    "SELECT sql FROM sqlite_master WHERE name='onharu_overview_utc'"
).fetchone()[0] == raw_sql

db.execute(
    "INSERT INTO metric_excluded_devices(site, device_id, reason) "
    "VALUES ('workers', 'dev', 'developer')"
)
counts = db.execute(
    "SELECT devices_seen, installs_observed, visitors_today, installed_app_openers_today "
    "FROM onharu_nonexcluded_overview_utc"
).fetchone()
assert counts == (10, 0, 10, 0), counts
segments = dict(db.execute(
    "SELECT segment, COUNT(*) FROM onharu_device_segments_utc GROUP BY segment"
).fetchall())
assert segments == {
    "developer_confirmed": 1,
    "unclassified": 1,
    "qa_suspected_high": 6,
    "qa_suspected": 3,
}, segments
assert db.execute("SELECT COUNT(*) FROM metric_devices").fetchone()[0] == 11
assert db.execute("SELECT COUNT(*) FROM metric_daily_visits").fetchone()[0] == 11
print("PASS SQL migration: repeatable, preserves raw data, filters confirmed developer, labels uncertain QA")
