# レビュー：影響範囲で分ける

**変更の影響範囲を CI が決め、段階に応じて求めるレビューを変える。** critical は、人がファイルを開いて行にコメントを付けるまでマージできない（「読まずにマージ」を物理的に難しくする）。

指摘の中身の基準（何を指摘し、何を指摘しないか、どう返すか）は [REVIEW.md](../REVIEW.md)。

## 段階

| 段階 | 例 | 求めるもの | マージ |
| --- | --- | --- | --- |
| **critical** | 認証と認可、スキーマとマイグレーション、削除、暗号と秘密情報、外に出す API、`infra/`、workflow・ルール・判定・`AGENTS.md`、ADR と PRD | AI の承認 ＋ CODEOWNER の総括コメント ＋ **当たった各ファイルに CODEOWNER の行コメント** | 手で |
| **standard** | アプリのコード一般、依存の更新 | AI の承認（なければ CODEOWNER の総括コメントで代える） | 手で |
| **light** | 文書だけ、テストだけ | なし | **自動マージ（squash）** |

正本は [`.github/settings/risk.yml`](../.github/settings/risk.yml)。

### 段階の決め方（risk.yml を直すときの物差し）

次の3つで重い方に倒す。感覚で決めない。

| 物差し | 問い |
| --- | --- |
| 壊れたときの範囲 | 個人情報・データの消失・お金・法令・止まる範囲に届くか |
| 戻せるか | 元に戻せるか（マイグレーション、削除、外に出した約束は戻せない） |
| 気づけるか | テストや監視で拾えるか（暗号、権限の誤りは動いてしまう） |

### 段階を上げるシグナル（下げることはしない）

| シグナル | 上げ方 |
| --- | --- |
| 依存の変更（lockfile） | standard 以上 |
| workflow の `permissions`・`secrets.`・`pull_request_target`・`id-token` に触れる行 | critical |
| テストの削除・減少 | 1段 |
| 差分が `large_change_lines`（800 行）を超える | 1段 |
| PR の「ADR への影響」が「なし」以外 | critical |
| 手で `review:escalate` を付ける | critical（全ファイルが対象） |

依存の向きから影響範囲を広げる計算（変えたモジュールを使っている側まで逆にたどる）は、第2段階で足す。差し込み口は `risk.classify()`。

## 流れ

```
PR を開く・push する
  └ review（pull_request_target、main の側の設定で動く）
       ├ 段階を判定 → review:critical / standard / light のラベル
       ├ PR にコメント：理由、読むファイル、領域、ツアー、担当
       ├ light なら自動マージを入れる（light でなくなったら外す）
       └ review-gate（コミットのステータス）を付ける
レビュー・行コメントが付く
  └ review-events → review-gate（workflow_run、main の側で動く）が付け直す
review-gate が success ＋ check が success → マージできる
```

**判定は PR の側では動かない。** 設定（risk.yml、CODEOWNERS）とスクリプトは main の側のものを使い、PR のコードは checkout も実行もしない。PR が自分の段階を下げたり、関門を書き換えたりできないように。risk.yml と判定のスクリプトの変更自体も critical。

## critical のレビューの仕方

1. PR のコメントの「読むファイル」と、その領域のツアー（`.tours/`）を開く。初めての領域なら、ツアーを先に歩く
2. **各ファイルを開き、読んだ所に行コメントを付ける**。指摘なら REVIEW.md の重さ（`[必須]`・`[推奨]`・`[範囲外]`）を先頭に、確かめた記録なら `確認：〜`。中身のない「LGTM」は、印にはなっても読んだ記録にならない
3. 最後に「Comment」でレビューを送る。総括の型：

```
読んだ所：
確かめたこと：（動かしたもの、テスト、preview の結果）
懸念・宿題：（なければ「なし」）
```

- 自分の PR は「承認」できないが、「コメント」のレビューは付けられる。一人で回している間はこれが印になる
- 人のコメントは、**critical のファイルを最後に変えたコミット以降**のものだけを数える。レビューの後に critical のファイルを直したら、付け直す（critical でないファイルの修正なら、そのまま）
- bot（Jules、CodeRabbit）のコメントは数えない
- 担当は CODEOWNERS（最後に当たった行）。チーム（`@org/team`）が担当なら、bot 以外の関係者を数える。関係者は `author_association` が OWNER、MEMBER、COLLABORATOR の人か、リポジトリに書き込みの権限がある人。個人の担当も、関係者でなければ数えない
- `reviewer_must_have_toured: true` にすると、その領域のツアーを済ませた人（`.github/settings/ownership.yml`）のコメントだけを数える

## AI のレビュー（CodeRabbit）

`settings.ai_reviewer: coderabbit`。設定は [`.coderabbit.yaml`](../.coderabbit.yaml)。

- `auto_approvals.enabled: true`：指摘があれば「変更を求める」、片づけば CodeRabbit が承認する。関門は**最新のコミットへの承認**を見る
- **公開リポジトリ**：無償で回る。ただし小さな OSS では、既定だと頼まないと回らないことがある
  - まず `.coderabbit.yaml` の `auto_review.enabled: true` で回るかを確かめる
  - 回らなければ `settings.ai_request_comment: true` にする（PR を開いたときに `@coderabbitai review` とコメントする）。**bot のコメントに CodeRabbit が反応するかは未確認**。反応しなければ人が書く
- **private リポジトリ**：有料のプランが要る（要検討）。入れない間は `ai_reviewer: none` にする。standard は CODEOWNER の総括コメントで、critical は総括と行コメントで回る
- CodeRabbit が止まったとき：`@coderabbitai approve` で上書きできる。standard は CODEOWNER の総括コメントでも通る

## 自動マージ（light）

- light の PR は、check と review-gate が通れば自動で squash マージされる
- 途中の push で light でなくなったら、自動マージは外れる
- 自動マージは、プランとルールの強制に依存する（private で強制されないプランでは使えないことがある）

## 校正

- 障害・手戻りの振り返りで、`risk.yml` を直す（パターン、段階、シグナル）
- light・standard で通った変更が後で問題を起こしたら、Issue に `review:` のラベルと一緒に記録する。分け方が当たっているかを後から確かめるため
