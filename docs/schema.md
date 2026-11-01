# データベーススキーマ（Cloudflare D1）

Tenkyu のデータベース（Cloudflare D1）のスキーマ定義です。

## 基本方針

- **主体の台帳を持たない**: 利用者の台帳そのものは持たず、内部の主体 ID（`sub`）を参照するだけにします（ADR 0017）。
- **OIDC クレームとの対応**: 列の名前は、後で ID トークンの標準項目（`sub`, `amr`, `auth_time` など）に移しやすい名前にします。
- **平文の個人情報・秘密値を持たない**: メールアドレスや確認コードは平文で持たず、ハッシュ値（`_hash`）で保持します。認証の記録（`auth_events`）にも平文の入力値を残しません。
- **日時の表現**: 日時はすべて UNIX エポック秒（`INTEGER`）で保持します。

## マイグレーション一覧

マイグレーションは `migrations/` ディレクトリに次のファイル名で配置し、順に適用します。

| ファイル名 | 対象の表 | 目的 |
| --- | --- | --- |
| `0001_identities.sql` | `identities` | 主体と認証手段（プロバイダと識別子）の紐付け |
| `0002_sessions.sql` | `sessions` | サーバー側のセッション（ログイン状態）の管理 |
| `0003_auth_events.sql` | `auth_events` | 認証の監査記録（入力値は持たない） |
| `0004_email_codes.sql` | `email_codes` | メール確認コードの一時保持（宛先とコードはハッシュ） |

---

## 表の定義

### 1. `identities`（認証手段）

主体（利用者）に紐づく認証手段を管理する表です。  
1つの主体 ID（`sub`）に対して、パスキー、メール確認コード、外部認証（Firebase 等）などの複数の認証手段が紐づきます。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。認証手段レコードの一意識別子（ULID または UUIDv4） |
| `sub` | `TEXT` | 否 | なし | 主体の ID。Mizucho の `principals.id`。OIDC の `sub` クレームに対応 |
| `provider` | `TEXT` | 否 | なし | 認証手段の種類（例: `'email_code'`, `'passkey'`, `'firebase'`） |
| `provider_subject` | `TEXT` | 否 | なし | プロバイダごとの識別子（例: Firebase の uid、クレデンシャル ID 等） |
| `created_at` | `INTEGER` | 否 | なし | レコード作成時刻（UNIX エポック秒） |
| `disabled_at` | `INTEGER` | 可 | `NULL` | 無効化の時刻（UNIX エポック秒）。有効な場合は `NULL` |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **一意制約**: `UNIQUE (provider, provider_subject)`  
  同一プロバイダの中で同じ識別子が重複して登録されることを防ぎます。

---

### 2. `sessions`（セッション）

サーバー側で保持するログイン状態（セッション）を管理する表です。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。セッション ID（暗号学的に安全なランダム文字列 / セッショントークン） |
| `sub` | `TEXT` | 否 | なし | 主体の ID。OIDC の `sub` クレームに対応 |
| `service` | `TEXT` | 否 | なし | 接続先サービス識別子（例: `'engawa'`, `'bunko'`。OIDC の `aud` / `client_id` に対応） |
| `amr` | `TEXT` | 否 | なし | 認証手段。OIDC の `amr`（Authentication Methods References）に対応（例: `'email_code'`, `'passkey'`, `'firebase'`） |
| `auth_time` | `INTEGER` | 否 | なし | 本人確認（認証）が成功した時刻（UNIX エポック秒。OIDC の `auth_time` クレームに対応） |
| `created_at` | `INTEGER` | 否 | なし | セッション作成時刻（UNIX エポック秒） |
| `last_active_at` | `INTEGER` | 否 | なし | 最終操作時刻（UNIX エポック秒。無操作による自動ログアウト判定に使用） |
| `expires_at` | `INTEGER` | 否 | なし | セッションの絶対有効期限（UNIX エポック秒） |
| `revoked_at` | `INTEGER` | 可 | `NULL` | 失効の時刻（UNIX エポック秒。明示的なログアウトや同時セッション数制限で失効したときに記録） |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **インデックス**: `CREATE INDEX idx_sessions_sub_service ON sessions (sub, service);`  
  主体のサービスごとのアクティブセッション数を確認し、同時ログイン制限を守るために使用します。

---

### 3. `auth_events`（認証の記録）

いつ、どのサービスで、誰が、どの手段でログインを試み、結果がどうだったかを記録する監査用の表です。

#### 平文の入力値を持たない原則

- **平文のメールアドレスや確認コードを入れる列はありません。**
- 不正なログイン試行があっても、入力されたメールアドレスやコードをログや記録に残さないため、列名にも `email` や `code` を含むものは定義しません。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。イベントの一意識別子（ULID または UUIDv4） |
| `event_type` | `TEXT` | 否 | なし | イベントの種類（例: `'login'`, `'logout'`, `'token_refresh'`, `'session_revoked'`） |
| `sub` | `TEXT` | 可 | `NULL` | 主体の ID（任意。ログイン失敗時や主体特定前の試行時は `NULL`。特定できた場合は `sub` を設定） |
| `service` | `TEXT` | 否 | なし | 対象サービス識別子（例: `'engawa'`, `'bunko'`） |
| `amr` | `TEXT` | 可 | `NULL` | 試行した認証手段。OIDC の `amr` に対応（例: `'email_code'`, `'passkey'`, `'firebase'`。不明な場合は `NULL`） |
| `result` | `TEXT` | 否 | なし | 結果（`'success'` または `'failure'`） |
| `created_at` | `INTEGER` | 否 | なし | イベント発生時刻（UNIX エポック秒） |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **インデックス**: `CREATE INDEX idx_auth_events_created_at ON auth_events (created_at);`  
  保存期限を過ぎた古い記録の自動消去（ADR 0006）や時系列検索に使用します。

---

### 4. `email_codes`（確認コード）

メールで送信する6桁の確認コードを一時保持し、検証するための表です。

#### ハッシュ保持の原則

- **メールアドレスやコードを平文で入れる列はありません。**
- データベースが参照された場合でも利用者のメールアドレスや有効なコードが直接漏洩しないよう、宛先とコードは平文ではなく暗号学的ハッシュ値（SHA-256 等）で保持します。
- 宛先とコードの列の名前は、ハッシュ値であることを明示するため **`_hash` で終わる名前**（`destination_hash`, `code_hash`）にします。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。確認コードの一意識別子（ULID または UUIDv4） |
| `destination_hash` | `TEXT` | 否 | なし | 宛先（メールアドレス）のハッシュ値。平文のメールアドレスは保持しない |
| `code_hash` | `TEXT` | 否 | なし | 発行した6桁の確認コードのハッシュ値。平文のコードは保持しない |
| `expires_at` | `INTEGER` | 否 | なし | 有効期限の時刻（UNIX エポック秒） |
| `attempt_count` | `INTEGER` | 否 | `0` | 入力試行回数（ブルートフォース攻撃防止のため、規定回数を超えたら無効化） |
| `consumed_at` | `INTEGER` | 可 | `NULL` | 使用済みの時刻（UNIX エポック秒。未使用時は `NULL`） |
| `created_at` | `INTEGER` | 否 | なし | コード発行時刻（UNIX エポック秒） |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **インデックス**: `CREATE INDEX idx_email_codes_lookup ON email_codes (destination_hash, expires_at);`  
  宛先ハッシュと有効期限による高速な検証検索に使用します。
