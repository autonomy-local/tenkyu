# 配備（デプロイ）

fork した人が同じ構成を自分の Cloudflare アカウントに立てられるようにするための、配備の考え方と手順の骨子です。
関連する決定事項は [ADR 0003](decisions/0003-リポジトリ・秘密情報・デプロイ.md) および [ADR 0017](decisions/0017-Tenkyu（Account基盤）の初手.md) を参照してください。

## Pulumi と wrangler の役割分担

インフラ構成（IaC）には Pulumi を使い、Worker のコード配備やデータベースマイグレーションの適用には wrangler を使います。

| ツール | 受け持つもの | 理由・備考 |
| --- | --- | --- |
| **Pulumi** | ・D1 データベースの作成・管理<br>・Worker の基本設定（ルーティング等）<br>・Service Bindings の結び付け<br>・秘密の値（シークレット）の宣言<br>・Cloudflare Access ポリシー | インフラ構成の再現性とポータビリティを確保するため（ADR 0017）。設定の正本を特定のクラウドの独自形式に寄せず IaC で管理する |
| **wrangler** | ・Worker コードの配備<br>・D1 マイグレーションの適用（`wrangler d1 migrations apply`） | アプリケーションコードのビルド・デプロイやマイグレーション実行に特化して利用する（ADR 0003） |

## 配備の順番

複数サービスが連携する構成において、配備の順番は**Tenkyu（auth Worker）が先**、**呼び出し側のサービス（engawa、Bunko など）がそのあと**です。

```
[Tenkyu (auth Worker)] (先に配備)
        ▲
        │ Service Binding
[呼ぶ側のサービス] (後から配備: engawa, Bunko など)
```

### 理由
- Tenkyu は各サービスから Service Binding 経由で呼び出される認証基盤・共有コンポーネントです。
- 呼び出し先のリソースが存在しないと呼び出し側のバインドや通信が成立しないため、依存関係の上流となる Tenkyu を常に先行して配備します。
- 後方互換性を保ちながら Tenkyu を先行更新することで、呼び出し元サービスの中断を防ぎます（ADR 0017）。

---

## 手順

> 各手順の具体的なコマンドや詳細設定は、今後の Issue で順次整備します。

### Pulumi の準備

### 秘密の値

#### 署名の鍵の版

署名の鍵は2つの秘密の値に置きます（`src/keys/secret-keystore.ts`）。

| 秘密の値 | 中身 | 使い道 |
| --- | --- | --- |
| `SIGNING_KEY_JWK` | 今の版の秘密鍵（P-256 の JWK。`kid` に版の名前を入れる） | 署名と検証 |
| `SIGNING_KEY_JWK_PREVIOUS` | 前の版の鍵（任意。秘密鍵でも公開鍵でもよい） | 検証だけ |

入れ替えの手順：

1. 新しい鍵を作り、`kid` に新しい版の名前（例：`2026-12-v2`）を入れる
2. 今の `SIGNING_KEY_JWK` の値を `SIGNING_KEY_JWK_PREVIOUS` に入れる（`wrangler secret put SIGNING_KEY_JWK_PREVIOUS`）
3. 新しい鍵を `SIGNING_KEY_JWK` に入れる（`wrangler secret put SIGNING_KEY_JWK`）。ここから署名は新しい版になり、前の版で署名したものも検証できる
4. 前の版で署名したものの期限がすべて切れたら、`SIGNING_KEY_JWK_PREVIOUS` を消す（`wrangler secret delete SIGNING_KEY_JWK_PREVIOUS`）

2つの値の `kid` が同じだと、Worker は起動の時に失敗します。

#### メールの送信（Resend）

確認コードのメールは Resend で送ります（`src/mail/`）。送信の中身は設定 `MAILER` で選びます。

| 設定 | 種類 | 中身 |
| --- | --- | --- |
| `MAILER` | vars | `resend`（本番）か `memory`（手元とテスト。送らずに残すだけ）。ほかの値や空だと、メールを送るときに例外で止まる |
| `RESEND_API_KEY` | 秘密の値 | Resend の API キー。送信だけの権限（Sending access）で、送信元のドメインに絞って作る |
| `MAIL_FROM` | vars | 差出人（例：`Tenkyu <no-reply@auth.example.org>`）。Resend で確かめ済みのドメインのアドレスにする |

手順：

1. Resend で送信元のドメインを足し、表示された DNS のレコード（SPF の TXT、DKIM の TXT、戻りの MX）を、そのドメインの DNS に足す。Resend の画面でドメインが確かめ済みになるまで待つ
2. DMARC の TXT（`_dmarc.<ドメイン>`、まず `p=none`）を足す。届かないメールの報告を見てから強める
3. Resend で API キーを作る。権限は「Sending access」、ドメインは 1. のものに絞る。キーは画面に一度しか出ないので、そのまま次の手順で入れる（手元のファイルやチャットに貼らない）
4. Worker に秘密の値を入れる：`wrangler secret put RESEND_API_KEY`
5. `MAILER = "resend"` と `MAIL_FROM` を配備先の vars に入れる（配備先ごとの値なので、Pulumi の Worker の設定で入れる。今-6c）
6. テスト環境でログインのコードを1通送り、届くこと、`auth_events` に `code_send` の `success` が残ることを確かめる

キーの入れ替えは [runbook/rotate-secrets.md](runbook/rotate-secrets.md) の手順に従います。

### 配備

### 運営者を足す・外す

管理用の口や運用者向けのエンドポイントは、Cloudflare Access によって保護されています。
アクセスを許可する運営者の出入り（追加・削除）は、Pulumi を通じて行います。

#### 方針
- **リポジトリへの非記載**: 運営者の個別情報（メールアドレスなど）は、Git リポジトリのソースコードや設定ファイル（`Pulumi.yaml` など）に直接コミットしません。
- **スタック設定の利用**: 運営者のリストは環境依存の値として扱い、Pulumi のスタック設定（`pulumi config`）に保持します。

#### 手順の流れ
1. **スタック設定の更新**:
   対象スタックを選択し、運営者リストの設定値を変更します。
   ```sh
   pulumi stack select <対象スタック名>
   pulumi config set <キー名> '<更新後の運営者設定>'
   ```
2. **変更内容の確認**:
   `pulumi preview` を実行し、Cloudflare Access のポリシーに対する差分が想定通り（対象の運営者のみ追加・削除されているか）を確認します。
   ```sh
   pulumi preview
   ```
3. **設定の反映**:
   `pulumi up` を実行して Cloudflare Access ポリシーを更新します。
   ```sh
   pulumi up
   ```

> **注意**: 実在する個人のメールアドレスや名前をコードやドキュメントに直接記録しないでください。

### 戻し方
