# セキュリティレビュー チェックリスト

本稼働の前にアカウント基盤の実装を確かめるためのセキュリティ観点のチェックリストです。
関連する設計・方針: [SECURITY.md](../SECURITY.md)、[ADR 0001](decisions/0001-セキュリティと扱うデータ.md)、[ADR 0002](decisions/0002-認証と認可.md)、[ADR 0004](decisions/0004-可観測性と運用の初手.md)、[ADR 0017](decisions/0017-Tenkyu（Account基盤）の初手.md)、[データベーススキーマ](schema.md)。

---

## 1. セッション

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| サーバー側でセッション状態を保持し、クライアントに渡すセッショントークンの平文を DB に保存せず暗号学的ハッシュで照合していること | `migrations/0002_sessions.sql`<br>`src/auth/session.ts`<br>`test/session.test.ts` | | |
| 主体（`sub`）およびサービスごとの同時アクティブセッション数の上限が正しく検証・強制されること | `src/auth/session.ts`<br>`test/session.test.ts` | | |
| 無操作による自動ログアウト（`last_active_at` の判定）および絶対有効期限（`expires_at`）による失効が正しく機能すること | `src/auth/session.ts`<br>`test/session.test.ts` | | |
| 明示的なログアウト時や同時セッション数超過時に、セッションが正しく失効（`revoked_at` の記録）され以降利用不能になること | `src/auth/session.ts`<br>`test/session.test.ts` | | |

---

## 2. クッキー

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| セッションクッキーに安全な属性（`HttpOnly`、`Secure`、適切な `SameSite` 属性および `Path`）が常に付与されていること | `src/auth/cookie.ts`<br>`test/cookie.test.ts` | | |
| クッキーのスコープが各サービスのドメインごとに分離されており、不適切なクロスドメイン共有や漏えいが防がれていること | `src/auth/cookie.ts`<br>`test/cookie.test.ts` | | |
| プレフィックス（`__Host-` や `__Secure-`）の付与など、クッキーインジェクションや改ざん防止の対策がなされていること | `src/auth/cookie.ts`<br>`test/cookie.test.ts` | | |

---

## 3. 確認コード

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| メールの確認コードおよび宛先メールアドレスが DB に平文で保持されず、鍵付きハッシュ（HMAC-SHA256 等）で保存・照合されていること | `migrations/0004_email_codes.sql`<br>`src/auth/email_code.ts`<br>`test/email_code.test.ts` | | |
| 総当たり攻撃（ブルートフォース）防止のため、入力試行回数の上限（`attempt_count`）が検証され、上限到達時に無効化されること | `src/auth/email_code.ts`<br>`test/email_code.test.ts` | | |
| 確認コードの有効期限が短時間（例: 10〜15分等）に設定され、期限切れコードでの検証が拒絶されること | `src/auth/email_code.ts`<br>`test/email_code.test.ts` | | |
| 確認コードは検証成功時に即座に使用済み（`consumed_at` の記録）とされ、二重利用（リプレイ）が防止されていること | `src/auth/email_code.ts`<br>`test/email_code.test.ts` | | |
| 同一宛先・同一IPからの過剰なコード再発行を防ぐレートリミットまたは発行間隔制限が設けられていること | `src/auth/email_code.ts`<br>`test/email_code.test.ts` | | |

---

## 4. パスキー

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| WebAuthn の登録および認証時に、Origin、RP ID、および Challenge が暗号学的に厳格に検証されていること | `src/auth/passkey.ts`<br>`test/passkey.test.ts` | | |
| 認証・登録の Challenge が暗号学的に安全に生成され、ワンタイムかつ有効期限付きで検証されていること（リプレイ攻撃の防止） | `src/auth/passkey.ts`<br>`test/passkey.test.ts` | | |
| パスキーの公開鍵およびクレデンシャル情報が主体（`sub`）に紐づいて `identities` に安全に管理・保存されていること | `migrations/0001_identities.sql`<br>`src/auth/passkey.ts`<br>`test/passkey.test.ts` | | |
| ユーザー検証（User Verification: 生体認証やPIN）の要求方針が意図どおりに適用されていること | `src/auth/passkey.ts`<br>`test/passkey.test.ts` | | |

---

## 5. Access

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| Worker が外部に直接公開されず、内部専用（`workers_dev = false`、公開ルートなし）として設定されていること | `wrangler.jsonc`<br>`infra/cloudflare/worker.ts` | | |
| 管理用・運用者向けの画面やエンドポイントが Cloudflare Access の認証ポリシーの背後に配置されていること | `infra/cloudflare/access.ts`<br>`infra/cloudflare/index.ts` | | |
| engawa や Bunko などの連携サービスからのアクセスが Service Binding 経由に制限され、正しく呼び出し元が検証されていること | `src/index.ts`<br>`test/service_binding.test.ts` | | |

---

## 6. ログ

| 項目 | 見る場所 | 結果 | Issue |
| --- | --- | --- | --- |
| 標準出力・エラーログ等の運用ログに入力値（平文のメールアドレス、確認コード等の秘密・個人情報）が出力されないこと | `src/utils/logger.ts`<br>`test/logger.test.ts` | | |
| 認証監査ログ（`auth_events`）に入力値の平文列を持たず、イベント種別・識別子・時刻・結果のみが記録されていること | `migrations/0003_auth_events.sql`<br>`src/auth/events.ts`<br>`test/events.test.ts` | | |
| 保存期限を過ぎた古い認証ログ・セッション・確認コードレコードが定期的に削除・消去されること（データ保持制限の遵守） | `src/tasks/cleanup.ts`<br>`test/cleanup.test.ts` | | |
