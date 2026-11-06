-- Ranking por períodos com datas retroativas e versões de encerramento.
-- Preparação do D1 para produção: a demonstração atual ainda não utiliza D1.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ranking_periods (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 100),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  opened_at TEXT,
  closed_at TEXT,
  CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS ranking_closures (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES ranking_periods(id),
  version INTEGER NOT NULL CHECK(version >= 1),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  closed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(period_id,version)
);

CREATE TABLE IF NOT EXISTS ranking_audit (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES ranking_periods(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created','opened','closed','reopened','dates_edited')),
  detail_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ranking_period_dates ON ranking_periods(start_date,end_date,status);
CREATE INDEX IF NOT EXISTS idx_ranking_closed ON ranking_closures(period_id,closed_at);
CREATE INDEX IF NOT EXISTS idx_ranking_audit ON ranking_audit(period_id,occurred_at);
