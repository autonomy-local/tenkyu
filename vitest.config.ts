import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// NixOS 等で MINIFLARE_WORKERD_PATH が未設定の場合、npm の workerd を実行可能にする互換設定
if (process.platform === "linux" && !process.env.MINIFLARE_WORKERD_PATH) {
  const nixLd = process.env.NIX_LD;
  if (!existsSync("/lib64/ld-linux-x86-64.so.2") && nixLd) {
    try {
      const patchWorkerd = (dir: string, depth = 0) => {
        if (depth > 6 || !existsSync(dir)) return;
        for (const entry of readdirSync(dir)) {
          const fullPath = join(dir, entry);
          const lstat = lstatSync(fullPath, { throwIfNoEntry: false });
          if (lstat?.isDirectory()) {
            patchWorkerd(fullPath, depth + 1);
          } else if (entry === "workerd") {
            const stat = statSync(fullPath, { throwIfNoEntry: false });
            if (stat?.isFile()) {
              try {
                execFileSync(
                  "patchelf",
                  ["--set-interpreter", nixLd, fullPath],
                  {
                    stdio: "ignore",
                  },
                );
              } catch {
                // 失敗しても既存の起動フローを壊さない
              }
            }
          }
        }
      };
      patchWorkerd(join(process.cwd(), "node_modules/@cloudflare"));
      patchWorkerd(join(process.cwd(), "node_modules/.pnpm"));
    } catch {
      // 失敗しても既存の起動フローを壊さない
    }
  }
}

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.toml" },
      // migrations/ を読み、テストの前に test/apply-migrations.ts で手元の D1 に当てる
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(
            join(process.cwd(), "migrations"),
          ),
        },
        // 結合テスト：仮のサービスの Worker を並べて立て、Service Binding で Tenkyu を呼ばせる。
        // テストの中の Tenkyu は「vitest-pool-workers-runner-<test.name>」という名前で立つので、その名前に結ぶ
        serviceBindings: { SERVICE: "fixture-service" },
        workers: [
          {
            name: "fixture-service",
            modules: true,
            scriptPath: "./test/fixtures/service/index.js",
            compatibilityDate: "2024-04-05",
            serviceBindings: { TENKYU: "vitest-pool-workers-runner-tenkyu" },
          },
        ],
      },
    })),
  ],
  test: {
    // 仮のサービスから結ぶ名前（上の TENKYU）を決めるために固定する
    name: "tenkyu",
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
