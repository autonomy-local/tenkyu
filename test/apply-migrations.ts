import { applyD1Migrations, env } from "cloudflare:test";

// 各テストのファイルの前に、migrations/ を手元の D1 に当てる（当て済みのものは飛ばされる）
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
