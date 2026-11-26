import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
      /** 結合テストの仮のサービス（test/fixtures/service/） */
      SERVICE: Fetcher;
    }
  }
}
