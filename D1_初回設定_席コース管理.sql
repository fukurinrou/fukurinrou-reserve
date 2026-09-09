-- 2026-09-09 11:20 変更済み
-- Cloudflare D1「fukurinrou-osechi-db」で一度だけ実行してください。
-- 先に PRAGMA table_info(course_reservations); を実行し、trashed_at が無いことを確認します。

ALTER TABLE course_reservations ADD COLUMN trashed_at TEXT;

CREATE TABLE IF NOT EXISTS course_site_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
