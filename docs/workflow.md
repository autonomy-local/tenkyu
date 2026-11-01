# Issue から PR まで

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

## Jules に渡す

- 前提：Jules の GitHub アプリに、このリポジトリへのアクセスを与えておく
- Issue に `jules` を付けると、Jules が Issue にコメントして作業を始め、終わると PR のリンクを返す
- Jules は `AGENTS.md` を読む。規約は AGENTS.md に書き、Jules 専用の追記は作らない
- 渡す前に、Issue の「終了条件」「やらないこと」が埋まっていることを確かめる。あいまいな Issue を渡すと、範囲の外まで手を出す
- 同時に動かせる数に上限がある。一度に大量に付けない

## Claude に渡す

- Claude は `claude/<Issue番号>-<短い名前>` のブランチでコミットまでを行う。push と PR は人が行う
- コミットの作者は、過去のコミットに合わせる（git config は書き換えない）
