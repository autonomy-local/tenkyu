import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// NixOS 等で MINIFLARE_WORKERD_PATH が未設定の場合、npm の workerd を実行可能にする互換設定
if (process.platform === "linux" && !process.env.MINIFLARE_WORKERD_PATH) {
  const nixLd = process.env.NIX_LD;
  if (!existsSync("/lib64/ld-linux-x86-64.so.2") && nixLd) {
    try {
      const patchWorkerd = (dir, depth = 0) => {
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
