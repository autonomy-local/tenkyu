-- 主体の台帳の、D1 に置く簡単な中身（docs/schema.md の 5.）。本番の台帳は Mizucho で、この表は使わない
CREATE TABLE local_principals (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at INTEGER NOT NULL
);

-- 主体とサービスごとのセッションの制限。数字だけを持ち、役割の名前は持たない。行がなければ既定の値
CREATE TABLE local_session_policies (
  principal_id TEXT NOT NULL REFERENCES local_principals (id),
  service TEXT NOT NULL,
  max_concurrent_sessions INTEGER NOT NULL CHECK (max_concurrent_sessions >= 0),
  idle_timeout_seconds INTEGER NOT NULL CHECK (idle_timeout_seconds > 0),
  PRIMARY KEY (principal_id, service)
);
