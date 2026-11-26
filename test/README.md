# テスト

`pnpm run test` で、Vitest と `@cloudflare/vitest-pool-workers` を使い、Workers の実行環境（workerd）の中でテストを回します。設定は [vitest.config.ts](../vitest.config.ts) です。

## 立つもの

| もの | 中身 | テストからの呼び方 |
| --- | --- | --- |
| Tenkyu の Worker | `wrangler.toml` の `main`（`src/index.ts`） | `SELF.fetch(...)`（`cloudflare:test`） |
| 手元の D1 | `wrangler.toml` の `DB`。テストの前に `migrations/` を当てる（`test/apply-migrations.ts`） | `env.DB` |
| 仮のサービスの Worker | `test/fixtures/service/index.js`。engawa や Bunko の代わり | `env.SERVICE.fetch(...)` |

## 結合テスト（Service Binding）

本番では、engawa や Bunko が Service Binding で Tenkyu を呼びます。同じ形を手元で作り、口の約束を毎回の PR で確かめます。

```
テスト ──env.SERVICE──▶ 仮のサービス ──env.TENKYU──▶ Tenkyu
```

- 仮のサービスは `vitest.config.ts` の `miniflare.workers` に置き、ビルドせずにそのまま読み込みます。TypeScript でなく JavaScript で書きます
- 仮のサービスの `TENKYU` は、テストの中の Tenkyu の名前 `vitest-pool-workers-runner-tenkyu` に結びます。この名前は `test.name`（`tenkyu`）から決まるので、`test.name` を変えたら合わせて直します
- 仮のサービスに口を足すときは、`test/fixtures/service/index.js` にパスを足し、`test/` にテストを置きます。例は `test/service-binding.test.ts`（`/healthz` を呼ぶ）

## よく使うコマンド

```sh
pnpm run test                              # 全部
pnpm exec vitest run test/service-binding.test.ts   # 1つのファイル
```
