-- Estrutura futura de contas e permissoes. SMS permanece desligado.
-- Aplicar somente apos validar as rotas autenticadas no Worker (nao usada na demonstracao).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_accounts (
  id TEXT PRIMARY KEY,
  member_id TEXT UNIQUE REFERENCES members(id),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','master')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_credentials (
  account_id TEXT PRIMARY KEY REFERENCES user_accounts(id),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  iterations INTEGER NOT NULL CHECK (iterations >= 100000),
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_password_resets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES user_accounts(id),
  token_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  invalidated_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS user_security_audit (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT,
  target_account_id TEXT,
  event TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_role ON user_accounts(role, active);
CREATE INDEX IF NOT EXISTS idx_resets_open ON user_password_resets(account_id, expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_security_events ON user_security_audit(target_account_id, created_at);
