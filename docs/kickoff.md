# 着手の条件

**PRD と最初の ADR 7本がそろうまで、実装に入らない。** CI（`check` ジョブ）で強制する。

## そろえるもの

| # | 文書 | そろった状態 | 決めること |
| --- | --- | --- | --- |
| 1 | [`docs/prd/0001-プロダクト.md`](prd/0001-プロダクト.md) | 状態が「承認」 | 誰の何を変えるか、成功の物差し、やること／やらないこと、出口 |
| 2 | [ADR 0001 セキュリティと扱うデータ](decisions/0001-セキュリティと扱うデータ.md) | 状態が「採用」 | 扱うデータの重さ、個人情報の置き場所、脅威と守り |
| 3 | [ADR 0002 認証と認可](decisions/0002-認証と認可.md) | 〃 | 認証の手段、Tenkyu を使うか、役割と権限、セッション |
| 4 | [ADR 0003 リポジトリ・秘密情報・デプロイ](decisions/0003-リポジトリ・秘密情報・デプロイ.md) | 〃 | 環境、IaC、秘密情報の正本、デプロイと戻し方 |
| 5 | [ADR 0004 可観測性と運用の初手](decisions/0004-可観測性と運用の初手.md) | 〃 | ログの決まり（個人情報を残さない）、量と費用、障害の気づき方 |
| 6 | [ADR 0005 ライセンス](decisions/0005-ライセンス.md) | 〃 | 配布のライセンス、貢献の条件、第三者のコード |
| 7 | [ADR 0006 データの出口と削除](decisions/0006-データの出口と削除.md) | 〃 | 持ち出しの形式、削除の種類と期限、引き渡し |
| 8 | [ADR 0007 言語・ランタイムとテストの方針](decisions/0007-言語・ランタイムとテストの方針.md) | 〃 | 言語、主な依存、テストの層、CI の中身 |

各ファイルの冒頭のコメントに「決めること」の詳しい問いがある。正本は [`.github/settings/kickoff.yml`](../.github/settings/kickoff.yml)。

## 決め方

- **決めないと決めてよい。** 「先送りする」と決め、理由と覆す条件を書けば「採用」にしてよい。空欄のまま「採用」にしない
- 横断の ADR（working-out-loud の `docs/decisions/`）に従うだけなら、その番号を「関連」に書き、差分だけを書く
- 判断が割れる点は、先に Issue（決めてほしいこと）で出す
- **エージェントは下書きまで。** 「状態」を「承認」「採用」に書き換えるのは人。エージェントは `needs:decision` の Issue を取らない

## 強制のしかた

| 場面 | 動き |
| --- | --- |
| PR | そろっていないのに、`allowed_before_ready`（`docs/` `.github/` `scripts/` `README.md` `AGENTS.md` `LICENSE` など）の外を変えると `check` が落ちる → マージできない |
| PR（文書だけ） | そろっていなくても通る（PRD と ADR を書く PR はこれ） |
| main への push | 状況を表示するだけ |

手元で確かめる：

```sh
python3 scripts/check-kickoff.py           # 状況を表示
python3 scripts/check-kickoff.py --strict  # そろっていなければ終了コード 1
```

項目ごとの Issue は `scripts/bootstrap-repo.sh --kickoff-issues` で起こせる（`docs` `needs:decision` `p1` 付き）。

## そろった後

- 機能ごとの PRD は `docs/prd/0002-…` から足す（[`0000-template.md`](prd/0000-template.md) を写す）
- ADR は `docs/decisions/0008-…` から足す
- 項目を増やす・減らすときは `kickoff.yml` を直す（減らすのは ADR で理由を残してから）
