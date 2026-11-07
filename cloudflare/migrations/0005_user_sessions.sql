-- V10: sessões revogáveis e limite de tentativas. Não armazena tokens em texto puro.
CREATE TABLE IF NOT EXISTS user_sessions (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES user_accounts(id),
 token_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_account ON user_sessions(account_id,expires_at);
CREATE TABLE IF NOT EXISTS user_login_limits (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 failed_count INTEGER NOT NULL DEFAULT 0,
 locked_until TEXT
);
