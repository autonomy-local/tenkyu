# Issue から PR まで

機能を仕様から起こすときは、Spec Kit で spec.md と tasks.md を作り、Issue に変換する（[spec-driven.md](spec-driven.md)）。

**最初に、着手の条件（[kickoff.md](kickoff.md)）をそろえる。** PRD と ADR 0001〜0007 がそろうまで、文書以外の変更は main に入らない。

```
Issue を書く（テンプレート「タスク」）
  └ 終了条件が書けたら agent:ready
       ├ Jules に渡す   → jules を付ける → Jules が作業して PR を出す
       ├ Claude に渡す  → Claude がブランチでコミット → 人が push して PR
       └ 人がやる
  └ 判断が要る点があれば needs:decision（推測で進めない）
PR（テンプレートどおり、終了条件ごとの根拠と影響範囲の見立てを書く）
  └ CI（review）が段階を判定：critical / standard / light（docs/review.md）
  └ check と review-gate が通る → squash マージ（light は自動） → ブランチは自動で削除
```

## 終了条件の書き方（EARS）

振る舞いの終了条件は、EARS（Easy Approach to Requirements Syntax）の型で書く。主語は「システム」、述語は判定できる動作にする。各項目に判定の手段（テスト名、コマンドと結果、CI のジョブ名）を添える。

| 型 | 書き方 | 例 |
| --- | --- | --- |
| 常に | システムは〈動作〉する | システムは予約と取り消しの記録を残す |
| 事象 | 〈事象〉したとき、システムは〈動作〉する | 会員が空き枠を予約したとき、システムはその枠を埋める |
| 状態 | 〈状態〉の間、システムは〈動作〉する | 電波が無い間、システムは予約の確定を保留し、その旨を表示する |
| 望まない事象 | 〈望まない事象〉の場合は、システムは〈動作〉する | 同じ枠に2人が同時に予約した場合は、システムは後の1人を断る |
| 任意の機能 | 〈機能〉を備えるなら、システムは〈動作〉する | 承認の機能を備えるなら、システムは役員の承認まで予約を仮にする |

- 1項目に1つの動作。「〜し、〜し、〜する」と並べたくなったら分ける
- 「適切に」「速く」「改善する」は判定できないので使わない。数字か、観察できる結果にする
- Spec Kit の受け入れのシナリオ（Given/When/Then）は、そのまま使ってよい（「Given〈前提〉、When〈事象〉、Then〈結果〉」は事象の型と同じ）
- 文書やリファクタリングのように振る舞いが無いものは、確かめ方だけを書く（「`just check` が通る」「`docs/x.md` に手順がある」）

## ラベル

正本は [`.github/settings/labels.yml`](../.github/settings/labels.yml)。

| 分類 | ラベル | 使い方 |
| --- | --- | --- |
| 種別 | `feat` `fix` `docs` `chore` `refactor` `test` | Issue と PR に1つ。コミットの接頭辞と同じ |
| 進み具合 | `agent:ready` | 終了条件が書けていて、エージェントが取ってよい |
| | `agent:wip` | エージェントが作業中（取ったら付け、`agent:ready` を外す） |
| | `needs:decision` | 人の判断待ち |
| | `blocked` | 止まっている。理由を Issue に書く |
| 割り当て | `jules` | Jules に渡す |
| 優先度 | `p1` `p2` `p3` | 高・中・低 |
| 範囲 | `area:*` | リポジトリごとに足す |

## 外の人からの変更（フォーク）

**外からの PR は受け付けない。** フォークで直し、Issue「フォークでの変更のお知らせ」で知らせてもらう（[CONTRIBUTING.md](../CONTRIBUTING.md)）。

```
Issue（fork、needs:decision）
  └ 人が差分を読む（フォークの compare のリンク）
       ├ 取り込まない → 理由を書いて閉じる
       └ 取り込む → こちらで Issue（タスク）を起こし、終了条件を書く → agent:ready
                     → こちらのブランチで実装（コミットを使うなら Co-authored-by で名前を残す）
                     → 通常の PR とレビューの段階
```

- 取り込むかの判断は人が行う。エージェントは `fork` の Issue を取らない
- コミットをそのまま使ってよいのは、提供の条件（ライセンス、DCO）がそろっているときだけ。条件が未決（ADR 0005）の間は、読んで参考にするまで
- 止め方は二重：リポジトリの設定（Pull requests → Collaborators only）と、外からの PR を閉じる workflow（`external-pr.yml`）

## Jules に渡す

- 前提：Jules の GitHub アプリに、このリポジトリへのアクセスを与えておく
- Issue に `jules` を付けると、Jules が Issue にコメントして作業を始め、終わると PR のリンクを返す
- Jules は `AGENTS.md` を読む。規約は AGENTS.md に書き、Jules 専用の追記は作らない
- 渡す前に、Issue の「終了条件」「やらないこと」が埋まっていることを確かめる。あいまいな Issue を渡すと、範囲の外まで手を出す
- 同時に動かせる数に上限がある。一度に大量に付けない

## Claude に渡す

- Claude は `claude/<Issue番号>-<短い名前>` のブランチでコミットまでを行う。push と PR は人が行う
- コミットの作者は、過去のコミットに合わせる（git config は書き換えない）
