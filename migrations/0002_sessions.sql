-- サーバー側のセッション（docs/schema.md の 2.）。id はセッショントークンのハッシュで、平文のトークンは持たない
CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  sub TEXT NOT NULL,
  service TEXT NOT NULL,
  amr TEXT NOT NULL,
  auth_time INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX idx_sessions_sub_service ON sessions (sub, service);
