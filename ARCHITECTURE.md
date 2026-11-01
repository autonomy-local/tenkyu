# ARCHITECTURE

コードベースの地図。**変わりにくいことだけ**を書く。細部はコードとツアー（.tours/）に任せる。

## 鳥瞰

Tenkyu は、engawa、Bunko などのサービスから Service Binding で呼ばれる、内部専用の Cloudflare Worker。利用者のログインの画面と、各サービスからの検証の問い合わせに答え、D1 に確かめ方、セッション、認証の記録を持つ。主体の台帳は Mizucho が持つ。決定の本文は [ADR 0017](docs/decisions/0017-Tenkyu（Account基盤）の初手.md)。

## コードの地図

| 場所 | 中身 |
| --- | --- |
| `docs/` | PRD・ADR・規約 |
| `nix/`、`flake.nix` | 開発環境 |
| `scripts/` | リポジトリの運用（判定、着手の条件、設定の反映） |
| `.tours/` | コードツアー |

`src/`、`migrations/`、`infra/` は実装の Issue（#4、#6、#8）で足し、そのときこの表も直す。

## 依存の向き

実装に入るときに書く。認証の手段（`Verifier`）、署名の鍵（KeyStore）、主体の台帳は差し込み口の後ろに置き、中身に依存しない。

## critical の領域

**正本は [`.github/settings/risk.yml`](.github/settings/risk.yml)。** ここに当たる変更は、人がファイルを開いて行にコメントを付けるまでマージできない（[docs/review.md](docs/review.md)）。当たるファイルができたら、領域のツアーが要る。

| 領域 | 何が起きうるか | ツアー |
| --- | --- | --- |
| 認証と認可 | 他人としてログインできる | `.tours/authn.tour` |
| DB のスキーマ | 戻せない | `.tours/data-schema.tour` |
| 削除・消去 | 戻せない | `.tours/deletion.tour` |
| 暗号と秘密情報 | テストで落ちない誤り | `.tours/crypto-secrets.tour` |
| 外に出す API | 利用者が壊れる | `.tours/public-api.tour` |
| infra | 止まる・消える・費用が出る | `.tours/infra.tour` |
| リポジトリの規律 | 関門そのものが変わる | [`.tours/repo-rules.tour`](.tours/repo-rules.tour) |

## 横断の関心事

ログに入力の値（メールアドレス、コード）を残さない（ADR 0001、0004）。

## 変わらない決まり

- パスワードを持たない
- 所属、役割、業務のデータを持たない
- メールアドレスとパスキーの公開鍵を各サービスに渡さない。渡すのは内部の ID だけ
- 外部の ID を内部の主体の ID にしない
- 認証の口は後方互換を守り、Tenkyu を先に配備する
