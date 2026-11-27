-- 6桁の確認コード（docs/schema.md の 4.）。宛先とコードは鍵付きハッシュで持ち、平文は持たない
CREATE TABLE email_codes (
  id TEXT PRIMARY KEY NOT NULL,
  destination_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_email_codes_lookup ON email_codes (destination_hash, expires_at);
