-- Futebol de Sábado V8: dados de times, reservas, rodízio, estatísticas e histórico.
-- Aplicar após 0001_initial.sql. Nenhuma cobrança, SMS ou envio é ativado aqui.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS historical_interests (
 id TEXT PRIMARY KEY,
 match_id TEXT NOT NULL REFERENCES matches(id),
 member_id TEXT NOT NULL REFERENCES members(id),
 preferred_position TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(match_id,member_id)
);
CREATE INDEX IF NOT EXISTS idx_interest_match ON historical_interests(match_id,created_at);

CREATE TABLE IF NOT EXISTS team_draws (
 id TEXT PRIMARY KEY,
 match_id TEXT NOT NULL REFERENCES matches(id),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 players_per_team INTEGER NOT NULL DEFAULT 5 CHECK(players_per_team=5)
);
CREATE INDEX IF NOT EXISTS idx_draws_match ON team_draws(match_id,created_at);

CREATE TABLE IF NOT EXISTS team_players (
 draw_id TEXT NOT NULL REFERENCES team_draws(id),
 team_label TEXT NOT NULL,
 slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5),
 registration_id TEXT NOT NULL REFERENCES registrations(id),
 PRIMARY KEY(draw_id,team_label,slot),
 UNIQUE(draw_id,registration_id)
);

CREATE TABLE IF NOT EXISTS team_reserves (
 draw_id TEXT NOT NULL REFERENCES team_draws(id),
 registration_id TEXT NOT NULL REFERENCES registrations(id),
 queue_position INTEGER NOT NULL CHECK(queue_position >= 1),
 PRIMARY KEY(draw_id,registration_id),
 UNIQUE(draw_id,queue_position)
);

CREATE TABLE IF NOT EXISTS match_rotation_events (
 id TEXT PRIMARY KEY,
 draw_id TEXT NOT NULL REFERENCES team_draws(id),
 game_number INTEGER NOT NULL CHECK(game_number >= 1),
 team_a TEXT NOT NULL,
 team_b TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('a_wins','b_wins','draw')),
 leaving_team TEXT NOT NULL,
 entering_team TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(draw_id,game_number)
);

CREATE TABLE IF NOT EXISTS player_match_stats (
 registration_id TEXT PRIMARY KEY REFERENCES registrations(id),
 goals INTEGER NOT NULL DEFAULT 0 CHECK(goals BETWEEN 0 AND 200),
 assists INTEGER NOT NULL DEFAULT 0 CHECK(assists BETWEEN 0 AND 200),
 attendance INTEGER NOT NULL DEFAULT 0 CHECK(attendance IN (0,1)),
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS mvp_votes (
 match_id TEXT NOT NULL REFERENCES matches(id),
 voter_member_id TEXT NOT NULL REFERENCES members(id),
 candidate_registration_id TEXT NOT NULL REFERENCES registrations(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(match_id,voter_member_id)
);

CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY,
 registration_id TEXT NOT NULL REFERENCES registrations(id),
 match_id TEXT NOT NULL REFERENCES matches(id),
 type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','closed','cancelled')),
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 closed_at TEXT,
 sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications(match_id,status,created_at);
