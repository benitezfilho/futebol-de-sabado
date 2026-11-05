-- Futebol de Sabado | base relacional para o backend (SQLite)
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL UNIQUE,
 phone_verified_at TEXT NOT NULL,
 whatsapp_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp_opt_in IN (0,1)),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique ON members(lower(email)) WHERE email <> '';
CREATE TABLE IF NOT EXISTS matches (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 venue TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 opens_at TEXT NOT NULL,
 payment_deadline TEXT NOT NULL,
 queue_release_at TEXT NOT NULL,
 signup_closes_at TEXT NOT NULL,
 line_capacity INTEGER NOT NULL CHECK (line_capacity > 0),
 goalkeeper_capacity INTEGER NOT NULL DEFAULT 2 CHECK (goalkeeper_capacity >= 0),
 price_cents INTEGER NOT NULL DEFAULT 1500 CHECK (price_cents >= 0),
 state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','archived')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_id INTEGER NOT NULL REFERENCES matches(id),
 member_id INTEGER NOT NULL REFERENCES members(id),
 position TEXT,
 role TEXT NOT NULL CHECK (role IN ('line','goalkeeper')),
 state TEXT NOT NULL CHECK (state IN ('reserved','paid','waitlist','goalkeeper_review','confirmed_goalkeeper','expired','cancelled','interest')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 reserved_until TEXT,
 paid_at TEXT,
 queue_entered_at TEXT,
 UNIQUE(match_id,member_id)
);
CREATE INDEX IF NOT EXISTS registrations_by_match_state ON registrations(match_id,state,created_at,id);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_id INTEGER REFERENCES matches(id),
 registration_id INTEGER REFERENCES registrations(id),
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 registration_id INTEGER NOT NULL REFERENCES registrations(id),
 kind TEXT NOT NULL,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL,
 sent_at TEXT,
 UNIQUE(registration_id,kind,created_at)
);

-- Protecao inicial contra abuso do envio de SMS, por telefone e origem.
CREATE TABLE IF NOT EXISTS otp_rate_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 phone_hash TEXT NOT NULL,
 ip_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_events_phone ON otp_rate_events(phone_hash,created_at);
CREATE INDEX IF NOT EXISTS otp_events_ip ON otp_rate_events(ip_hash,created_at);
