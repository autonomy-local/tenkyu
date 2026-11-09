import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// NixOS 等で MINIFLARE_WORKERD_PATH が未設定の場合、npm の workerd を実行可能にする互換設定
if (process.platform === "linux" && !process.env.MINIFLARE_WORKERD_PATH) {
  const nixLd = process.env.NIX_LD;
  if (!existsSync("/lib64/ld-linux-x86-64.so.2") && nixLd) {
    try {
      const patchWorkerd = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir)) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath, { throwIfNoEntry: false });
          if (stat?.isDirectory()) {
            patchWorkerd(fullPath);
          } else if (entry === "workerd" && stat?.isFile()) {
            try {
              execFileSync("patchelf", ["--set-interpreter", nixLd, fullPath], {
                stdio: "ignore",
              });
            } catch {
              // 失敗しても既存の起動フローを壊さない
            }
          }
        }
      };
      patchWorkerd(join(process.cwd(), "node_modules/@cloudflare"));
    } catch {
      // 失敗しても既存の起動フローを壊さない
    }
  }
}

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
    }),
  ],
});
