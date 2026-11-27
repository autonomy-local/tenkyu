-- 認証の記録（docs/schema.md の 3.）。入力の値（メールアドレス、コード）を入れる列は持たない
CREATE TABLE auth_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  sub TEXT,
  service TEXT NOT NULL,
  amr TEXT,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_auth_events_created_at ON auth_events (created_at);
