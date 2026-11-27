-- パスキー（docs/schema.md の 6.）。公開鍵だけを持ち、秘密鍵や署名のデータは持たない
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY NOT NULL,
  sub TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX idx_passkeys_sub ON passkeys (sub);

-- パスキーのチャレンジ（docs/schema.md の 7.）。値は平文で持たず、ハッシュで一度だけ使える確かめに使う
CREATE TABLE passkey_challenges (
  challenge_hash TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges (expires_at);
