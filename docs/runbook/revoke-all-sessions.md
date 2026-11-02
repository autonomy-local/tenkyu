# 全セッションの失効（強制ログアウト）

Tenkyu のデータベース（Cloudflare D1）上で、すべてのセッションを失効させて利用者を強制ログアウトさせる手順書です。

## 目的と背景

トークンや秘密情報の漏えいの疑いがある場合や、セキュリティインシデントの発生時に、不正アクセスを防ぐために稼働中サービスの全利用者を一斉にログアウトさせる必要があります。

Tenkyu ではセッション状態を D1 の `sessions` 表で管理しています。セッションを無効化するには、`revoked_at` 列に現在時刻（UNIX エポック秒）を設定します。

---

## 実行コマンド

`wrangler d1 execute` を使用して、Tenkyu のデータベースに対して更新クエリを実行します。

### 1. 対象セッションの事前確認

現在アクティブ（有効期限内かつ未失効）なセッション数を確認します。

```sh
npx wrangler d1 execute tenkyu-db --remote --command "SELECT count(*) AS active_sessions FROM sessions WHERE revoked_at IS NULL AND expires_at > unixepoch();"
```

※ ローカル検証環境で実行する場合は `--remote` の代わりに `--local` を指定してください。

### 2. 全セッションの一括失効

未失効（`revoked_at IS NULL`）の全セッションの `revoked_at` に現在時刻（UNIX エポック秒）を書き込みます。

```sh
npx wrangler d1 execute tenkyu-db --remote --command "UPDATE sessions SET revoked_at = unixepoch() WHERE revoked_at IS NULL;"
```

---

## 確かめ方

### 1. 未失効セッションが存在しないことの確認

未失効のセッションが 0 件になっていることを確認します。

```sh
npx wrangler d1 execute tenkyu-db --remote --command "SELECT count(*) AS remaining_active FROM sessions WHERE revoked_at IS NULL;"
```

出力結果の `remaining_active` が `0` であれば、すべてのセッションに失効時刻が設定されています。

### 2. 失効時刻の確認

直近で失効処理されたセッションの `revoked_at` が正しく設定されていることを確認します。

```sh
npx wrangler d1 execute tenkyu-db --remote --command "SELECT id, sub, service, revoked_at FROM sessions ORDER BY revoked_at DESC LIMIT 5;"
```

### 3. アプリケーション側での挙動確認

- 連携サービス（engawa、Bunko 等）にアクセス中のブラウザで、セッションの有効期限切れ（要再ログイン）またはログイン画面へのリダイレクトが行われることを確認します。

---

## 利用者への影響

- **全利用者の強制ログアウト**:
  - ログイン中だったすべての利用者のセッションが無効化され、次回アクセス時または操作時にログイン画面へ戻されます。
- **未保存データの喪失リスク**:
  - 利用者が画面上で編集中のデータがある場合、再ログインが求められることで保存操作が中断される可能性があります。
- **再ログインの必要性**:
  - 業務・サービス利用を再開するには、再度パスキーやメール確認コード等の認証手順が必要となります。
- **各サービスのキャッシュ時間に伴う反映遅延**:
  - ADR 0004 および ADR 0017 に基づき、Service Binding 先の各サービスが検証結果を短い時間キャッシュしている場合、キャッシュが切れるまでのわずかな時間は操作が継続できることがあります。即時反映が必要な場合はキャッシュ時間の考慮も必要です。
