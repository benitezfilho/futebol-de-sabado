PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_e164 TEXT NOT NULL UNIQUE,
  preferred_position TEXT,
  photo_url TEXT,
  email_verified_at TEXT,
  phone_verified_at TEXT,
  whatsapp_consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(length(full_name) BETWEEN 3 AND 120)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  opens_at TEXT NOT NULL,
  payment_deadline_at TEXT NOT NULL,
  queue_release_at TEXT NOT NULL,
  interest_closes_at TEXT NOT NULL,
  capacity_outfield INTEGER NOT NULL CHECK(capacity_outfield > 0),
  max_goalkeepers INTEGER NOT NULL DEFAULT 2 CHECK(max_goalkeepers >= 0),
  price_cents INTEGER NOT NULL DEFAULT 1500 CHECK(price_cents >= 0),
  queue_payment_minutes INTEGER NOT NULL DEFAULT 30 CHECK(queue_payment_minutes BETWEEN 5 AND 1440),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  position TEXT,
  is_goalkeeper INTEGER NOT NULL DEFAULT 0 CHECK(is_goalkeeper IN (0,1)),
  status TEXT NOT NULL CHECK(status IN (
    'pending_payment','confirmed','waitlist','interest',
    'goalkeeper_pending','expired','cancelled'
  )),
  payment_due_at TEXT,
  paid_at TEXT,
  waitlisted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(match_id,member_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id),
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('manual_pix','exempt_goalkeeper')),
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  registration_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_matches_dates ON matches(status,starts_at);
CREATE INDEX IF NOT EXISTS idx_registrations_match_status ON registrations(match_id,status,is_goalkeeper);
CREATE INDEX IF NOT EXISTS idx_registrations_due ON registrations(status,payment_due_at);
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist ON registrations(match_id,status,waitlisted_at,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_match_date ON audit_log(match_id,created_at);
