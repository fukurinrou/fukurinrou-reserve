-- 2026-09-10 00:25 変更済み
CREATE TABLE IF NOT EXISTS course_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_ref TEXT NOT NULL UNIQUE, reservation_type TEXT NOT NULL,
  customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL, people INTEGER NOT NULL,
  reservation_date TEXT NOT NULL, reservation_time TEXT NOT NULL, seat_preference TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL DEFAULT '', drink_plan TEXT NOT NULL DEFAULT '', per_person_amount TEXT NOT NULL DEFAULT '',
  total_amount TEXT NOT NULL DEFAULT '', course_dishes TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT,
  trashed_at TEXT
);

CREATE TABLE IF NOT EXISTS course_site_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_reservation_availability (
  reservation_date TEXT PRIMARY KEY NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
