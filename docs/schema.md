# データベーススキーマ（Cloudflare D1）

Tenkyu のデータベース（Cloudflare D1）のスキーマ定義です。

## 基本方針

- **主体の台帳を持たない**: 利用者の台帳そのものは持たず、内部の主体 ID（`sub`）を参照するだけにします（ADR 0017）。
- **OIDC クレームとの対応**: 列の名前は、後で ID トークンの標準項目（`sub`, `amr`, `auth_time` など）に移しやすい名前にします。
- **平文の個人情報・秘密値を持たない**: メールアドレスや確認コード、セッショントークンは平文で持たず、ハッシュ値（`_hash` や照合用ハッシュ）で保持します。認証の記録（`auth_events`）にも平文の入力値を残しません。
- **日時の表現**: 日時はすべて UNIX エポック秒（`INTEGER`）で保持します。

## マイグレーション一覧

マイグレーションは `migrations/` ディレクトリに次のファイル名で配置し、順に適用します。

| ファイル名 | 対象の表 | 目的 |
| --- | --- | --- |
| `0001_identities.sql` | `identities` | 主体と認証手段（プロバイダと識別子）の紐付け |
| `0002_sessions.sql` | `sessions` | サーバー側のセッション（ログイン状態）の管理 |
| `0003_auth_events.sql` | `auth_events` | 認証の監査記録（入力値は持たない） |
| `0004_email_codes.sql` | `email_codes` | メール確認コードの一時保持（宛先とコードはハッシュ） |
| `0005_principals.sql` | `local_principals`、`local_session_policies` | Mizucho なしで動かすときの、主体の台帳の簡単な中身 |
| `0006_passkeys.sql` | `passkeys`、`passkey_challenges` | パスキーの公開鍵と、登録・ログインのチャレンジ |

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
| `id` | `TEXT` | 否 | なし | 主キー。セッション識別子（クライアントに発行するセッショントークンの暗号学的ハッシュ値を保存・照合し、平文のトークンは保持しない） |
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
- データベースが参照された場合でも利用者のメールアドレスや有効なコードが直接漏洩（または総当たりで復元）しないよう、宛先とコードは平文ではなく鍵付きハッシュ（HMAC-SHA256 等）で保持します。
- 宛先とコードの列の名前は、ハッシュ値であることを明示するため **`_hash` で終わる名前**（`destination_hash`, `code_hash`）にします。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。確認コードの一意識別子（ULID または UUIDv4） |
| `destination_hash` | `TEXT` | 否 | なし | 宛先（メールアドレス）の鍵付きハッシュ値。平文のメールアドレスは保持しない |
| `code_hash` | `TEXT` | 否 | なし | 発行した6桁の確認コードの鍵付きハッシュ値。平文のコードは保持しない |
| `expires_at` | `INTEGER` | 否 | なし | 有効期限の時刻（UNIX エポック秒） |
| `attempt_count` | `INTEGER` | 否 | `0` | 入力試行回数（ブルートフォース攻撃防止のため、規定回数を超えたら無効化） |
| `consumed_at` | `INTEGER` | 可 | `NULL` | 使用済みの時刻（UNIX エポック秒。未使用時は `NULL`） |
| `created_at` | `INTEGER` | 否 | なし | コード発行時刻（UNIX エポック秒） |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **インデックス**: `CREATE INDEX idx_email_codes_lookup ON email_codes (destination_hash, expires_at);`  
  宛先ハッシュと有効期限による高速な検証検索に使用します。

---

### 5. `local_principals`・`local_session_policies`（D1 に置く主体の台帳）

Mizucho なしで Tenkyu を動かすための、主体の台帳の簡単な中身（`src/principals/d1.ts`）が使う表です。
本番の台帳は Mizucho で、そのときはこの2つの表を使いません（基本方針の「主体の台帳を持たない」は本番の構成のことです）。
個人の情報は持たず、主体の ID と状態、サービスごとのセッションの制限（数字だけ）を持ちます。

#### `local_principals` の列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。主体の ID（UUIDv4）。Tenkyu の `sub` |
| `status` | `TEXT` | 否 | `'active'` | 主体の状態（`'active'` または `'suspended'`）。`'active'` 以外は認証できない |
| `created_at` | `INTEGER` | 否 | なし | 主体の作成時刻（UNIX エポック秒） |

#### `local_session_policies` の列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `principal_id` | `TEXT` | 否 | なし | 主体の ID（`local_principals.id`） |
| `service` | `TEXT` | 否 | なし | サービスの識別子（例: `'engawa'`, `'bunko'`） |
| `max_concurrent_sessions` | `INTEGER` | 否 | なし | 同時に持てるセッションの上限（`0` はログイン不可） |
| `idle_timeout_seconds` | `INTEGER` | 否 | なし | 無操作で失効するまでの秒数 |

#### 制約

- **主キー**: `local_principals` は `PRIMARY KEY (id)`、`local_session_policies` は `PRIMARY KEY (principal_id, service)`
- **検査**: `status` は `'active'` か `'suspended'`、`max_concurrent_sessions` は 0 以上、`idle_timeout_seconds` は 1 以上
- **既定の値**: 主体とサービスの行がないときは、同時のセッションは `1`、無操作の時間は `1800` 秒（30分）を返します

---

### 6. `passkeys`（パスキー）

主体が登録したパスキー（WebAuthn の資格情報）の公開鍵を置く表です。
1つの主体に、端末ごとに複数のパスキーを登録できます。秘密鍵と署名のデータは持ちません。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `id` | `TEXT` | 否 | なし | 主キー。行の一意識別子（UUIDv4） |
| `sub` | `TEXT` | 否 | なし | 主体の ID。OIDC の `sub` クレームに対応 |
| `credential_id` | `TEXT` | 否 | なし | 資格情報の ID（WebAuthn の credential ID、base64url） |
| `public_key` | `BLOB` | 否 | なし | 公開鍵（COSE の形のバイト列） |
| `sign_count` | `INTEGER` | 否 | `0` | 署名の回数。複製された認証器を見分けるために、ログインのたびに比べて更新する |
| `name` | `TEXT` | 否 | なし | 利用者が付けた名前（例: 「仕事の PC」）。管理の画面で見分けるため |
| `created_at` | `INTEGER` | 否 | なし | 登録の時刻（UNIX エポック秒） |
| `last_used_at` | `INTEGER` | 可 | `NULL` | 最後にログインに使った時刻（UNIX エポック秒）。まだ使っていなければ `NULL` |

#### 制約

- **主キー**: `PRIMARY KEY (id)`
- **一意制約**: `UNIQUE (credential_id)`。同じ資格情報を二重に登録させない
- **インデックス**: `CREATE INDEX idx_passkeys_sub ON passkeys (sub);`  
  主体のパスキーの一覧（管理の画面）に使います。

---

### 7. `passkey_challenges`（パスキーのチャレンジ）

パスキーの登録とログインで発行するチャレンジを、一度だけ使えるように置く表です。

#### ハッシュ保持の原則

- チャレンジの値は平文で持たず、ハッシュ（`challenge_hash`）で持ちます。確かめるときは、届いた値のハッシュで行を引きます。

#### 列一覧

| 列名 | 型 | NULL | 初期値 | 意味・説明 |
| --- | --- | --- | --- | --- |
| `challenge_hash` | `TEXT` | 否 | なし | 主キー。チャレンジの値のハッシュ |
| `expires_at` | `INTEGER` | 否 | なし | 有効期限の時刻（UNIX エポック秒） |
| `consumed_at` | `INTEGER` | 可 | `NULL` | 使用済みの時刻（UNIX エポック秒。未使用時は `NULL`） |

#### 制約

- **主キー**: `PRIMARY KEY (challenge_hash)`
- **インデックス**: `CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges (expires_at);`  
  期限を過ぎたチャレンジの消去に使います。
