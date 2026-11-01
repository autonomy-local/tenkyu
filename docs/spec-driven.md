# 仕様から Issue まで（Spec Kit）

機能の要求を Spec Kit（GitHub の仕様駆動開発の道具）で書き、**出口だけはこのリポジトリの型に固定する**：tasks.md から、テンプレート「タスク」の形の Issue を決まった変換で起こす。

```
/speckit-specify  → specs/<番号-機能>/spec.md   （要求：ユーザーストーリー、受け入れのシナリオ、範囲外）
/speckit-clarify  → [NEEDS CLARIFICATION] を片づける
/speckit-plan     → plan.md                     （設計。決定を伴うなら ADR の候補）
/speckit-tasks    → tasks.md                    （フェーズごとのタスク）
/speckit-analyze  → spec・plan・tasks の食い違いを確かめる（任意）
just spec-issues specs/<番号-機能>              （確認だけ）
just spec-issues-apply specs/<番号-機能>        （Issue を作る）
```

スラッシュコマンドの書き方はエージェントによって違う（Claude Code、Gemini CLI など）。

## 立ち上げ（リポジトリに1回）

```sh
nix develop                                     # specify（Spec Kit の CLI）が入っている
specify init --here --integration claude        # .specify/ とエージェントのコマンドができる
cp docs/spec-kit/constitution.md .specify/memory/constitution.md
```

- **constitution はこのリポジトリの文書を指すだけ**にする（[docs/spec-kit/constitution.md](spec-kit/constitution.md)）。規約の正本を二重にしない
- 見出しと印（`## Phase N:`、`User Story N - 題 (Priority: P1)`、`T001`、`[P]`、`[US1]` など）は英語のまま、中身は日本語で書く。変換がこれを読む
- 着手の条件がそろう前でも、`specs/`・`.specify/`・`.claude/` の変更は main に入れてよい（要求を書く作業なので）

## 変換の決まり（`scripts/spec/spec_to_issues.py`）

| tasks.md / spec.md | Issue |
| --- | --- |
| フェーズ（Setup、Foundational、User Story ごと、Polish） | **1フェーズ＝1 Issue**（1 Issue＝1 PR に寄せる） |
| フェーズのタスク（`T001`…、`[P]`） | やること（チェックリスト） |
| ストーリーの受け入れのシナリオ、Independent Test、Checkpoint | 終了条件 |
| `## Assumptions` の「範囲外」「対象外」 | やらないこと |
| フェーズの順（Setup → Foundational → ストーリー → Polish） | 前提となる Issue（番号でつなぐ） |
| 優先度 P1・P2・それ以外 | `p1`・`p2`・`p3` |
| 種別 | Setup・Polish は `chore`、それ以外は `feat`。全部に `spec` |

- **`agent:ready` は付けない。** 人が中身を見てから付ける（Jules に渡すなら `jules` も）
- 次の Issue には `needs:decision` を付ける：終了条件が作れない／やらないことが無い／そのストーリーに `[NEEDS CLARIFICATION]` が残る
- spec.md のどこかに `[NEEDS CLARIFICATION]` が残っていれば、`--apply` は止まる（`/speckit-clarify` で片づける。どうしても進めるなら `--allow-unclear`）
- 本文に `<!-- spec: <機能>/<フェーズ> -->` の印を入れる。同じ印の Issue があれば作らない（何度流してもよい。既存の Issue は書き換えない）

## このリポジトリの型との対応

| Spec Kit | このリポジトリ |
| --- | --- |
| constitution | `AGENTS.md`、`ARCHITECTURE.md`、ADR、principles を指すだけ |
| spec.md | 機能ごとの PRD に当たる。プロダクトの PRD（`docs/prd/0001`）の範囲に収める。別に `docs/prd/` を書かなくてよい |
| plan.md | 設計。決定を伴うなら Issue（決めてほしいこと）にして ADR にする |
| tasks.md | Issue の元。変換したら、進み具合は Issue と PR で追う |
| `/speckit-implement` | **使わない**。実装は Issue → PR → レビューの段階 |
| `/speckit-taskstoissues` | **使わない**（1タスク1 Issue になり、形が揺れる。Spec Kit でも非推奨になった） |

`specs/` と `.specify/` の変更は、要求の変更なので critical（[review.md](review.md)）。

## Kiro（後で）

Kiro（AWS）の `.kiro/specs/<機能>/`（requirements.md の EARS、design.md、tasks.md）も、同じ出口で読めるように変換を足せる。試すのは Spec Kit で回してから。
