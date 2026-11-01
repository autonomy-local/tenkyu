# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code、Jules、Gemini CLI など）と人のための共通の規約です。
エージェントごとの追記は `CLAUDE.md` などに書きます。**規約の正本はこのファイル**です。

## このリポジトリは何か

地域の組織が使うサービスのための、小さなアカウント基盤です。「この人は誰か」を確かめる部分だけを受け持ち、Cloudflare Workers の上で動きます。engawa、Bunko などのサービスが Service Binding で呼び出します。詳しくは [README.md](README.md)。

## 最初に読むもの

0. [ARCHITECTURE.md](ARCHITECTURE.md)：コードの地図と critical の領域
1. [docs/kickoff.md](docs/kickoff.md)：**着手の条件**。そろっていなければ実装に入らない
2. [docs/prd/](docs/prd/)：何を、誰のために作るか
3. 担当する Issue（終了条件・やらないこと・参考）
4. [docs/decisions/](docs/decisions/)：決着済みの事項。蒸し返さない
5. [docs/branching.md](docs/branching.md)、[docs/workflow.md](docs/workflow.md)

## 守ること

### 着手の条件

- PRD と ADR 0001〜0007 がそろうまで（`python3 scripts/check-kickoff.py` で全部 ✓）、**実装に入りません**。文書の下書きだけを扱います
- PRD の「承認」、ADR の「採用」への書き換えは人が行います。エージェントは書き換えません
- `needs:decision` の付いた Issue は取りません

### レビューの段階（[docs/review.md](docs/review.md)）

- critical の領域（[.github/settings/risk.yml](.github/settings/risk.yml)、[ARCHITECTURE.md](ARCHITECTURE.md)）を触る前に、その領域のツアー（`.tours/`）を読みます
- PR の「影響範囲（作成者の見立て）」を書きます。CI の判定と食い違ったら、その理由も書きます
- **レビューの関門を弱める変更をしません**（risk.yml の段階を下げる、判定の条件を外す、判定を PR の側で動かす）。必要なら Issue で相談します
- critical の領域のコードを大きく変えたら、ツアーも同じ PR で直します

### 作業の範囲

- **1つの作業で1つの Issue だけ**を扱います
- Issue に書かれた**終了条件**を満たすことだけを行います。範囲外の整形やリファクタリングはしません
- 終了条件があいまいなとき、判断に迷うときは、**推測で進めず**、Issue にコメントで質問し、`needs:decision` を付けて止まってください
- 決着済みの ADR に反する変更が要るときは、作業を止めて Issue で相談します

### Git

- `main` に直接 push しません。`main` から短命のブランチを切り、PR を出します（[docs/branching.md](docs/branching.md)）
- 1つの Issue に1つのブランチ、1つの PR
- コミットメッセージの先頭に種類を付けます：`feat:` `fix:` `docs:` `test:` `refactor:` `chore:`
- PR の本文はテンプレートに従い、対応する Issue（`Closes #番号`）と、**終了条件ごとに満たした根拠**、**移植か新規か**を書きます

### ファイルの編集

- 既存のファイルを全文で置き換えません。読んでから、必要な箇所だけを編集します
- 生成物（コード生成の出力など）を手で直しません。正本を直して生成し直します

### テスト

- 変更には、それを確かめるテストを付けます
- テストを通すために、テストの側を書き換えません。テストが仕様と食い違っている場合は Issue で相談します

### 秘密情報と安全

- 鍵、トークン、パスワードなどを**平文でコミットしない**でください
- 脆弱性やその疑いに気づいたら、**Issue や PR、コミットメッセージに詳細を書かず**、作業を止めて人に知らせてください（[SECURITY.md](SECURITY.md)）
- 外部のプロジェクトのコードを持ち込まないでください。参考にした資料がある場合は、出典を PR に書きます

### 文書

- 文書は日本語で、簡潔に書きます

## 作業の終わりにやること

1. テストと CI の `check` が通ることを確かめる
2. 決定を伴う変更なら `docs/decisions/` に ADR を足す。PR の「ADR への影響」には、関わる ADR の番号と理由を書く
3. PR の本文に、対応する Issue と、終了条件ごとの根拠を書く

## よく使うコマンド

正本は [justfile](justfile)（`just` で一覧）。開発環境は `nix develop`（[docs/environment.md](docs/environment.md)）。

```sh
nix develop          # 既定の開発シェル（.#ts .#cloud もある）
just check           # 着手の条件、整形、pre-commit のフック
just fmt             # 整形
```

- ツールは Nix の開発シェルの中のものだけを使います。`npm i -g` や `curl | sh` で入れません。足りないものは `nix/` に足す PR を出します
