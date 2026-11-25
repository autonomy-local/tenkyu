-- identities：主体と認証の手段（手段の種類と、手段ごとの識別子）のひもづけ（docs/schema.md）
CREATE TABLE identities (
  id TEXT NOT NULL PRIMARY KEY,
  sub TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER,
  UNIQUE (provider, provider_subject)
);
