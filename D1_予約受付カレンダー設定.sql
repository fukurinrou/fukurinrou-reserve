-- 2026-09-10 00:25 変更済み
-- Cloudflare D1 の「fukurinrou-osechi-db」→「コンソール」に貼り付けて実行してください。
-- すでに作成済みの場合も、安全に実行できます。

CREATE TABLE IF NOT EXISTS course_reservation_availability (
  reservation_date TEXT PRIMARY KEY NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
