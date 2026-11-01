# Constitution

<!--
Spec Kit の constitution（.specify/memory/constitution.md）に写す。
規約の正本はこのリポジトリの文書にある。ここは指し示すだけにし、中身を二重に持たない。
-->

## 正本

このプロジェクトの原則と規約の正本は、次の文書にある。spec・plan・tasks は、これらに従う。食い違ったら、これらが勝つ。

- `AGENTS.md`：作業の規約（範囲、Git、テスト、秘密情報、文書）
- `ARCHITECTURE.md`：コードの地図、依存の向き、critical の領域
- `docs/decisions/`：決着済みの決定（ADR）。蒸し返さない。plan で決定を伴うときは、ADR の候補として書き出す
- `docs/prd/`：プロダクトの要求。機能の spec は、プロダクトの PRD（0001）の範囲に収める
- `docs/kickoff.md`：着手の条件。そろうまで実装に入らない
- `docs/review.md`：レビューの段階
- 横断の原則：working-out-loud の `docs/principles.md`

## spec・plan・tasks の書き方

- **日本語**で書く。ただし Spec Kit のテンプレートの**見出しと印**（`## Phase N:`、`User Story N - 題 (Priority: P1)`、`**Acceptance Scenarios**`、`**Independent Test**`、`**Checkpoint**`、`T001`、`[P]`、`[US1]`、`[NEEDS CLARIFICATION: …]`）は**英語のまま**残す（`scripts/spec/spec_to_issues.py` がこれを読んで Issue を起こす）
- 受け入れのシナリオは Given/When/Then、要求は EARS の型（`docs/workflow.md` の「終了条件の書き方」）で書く
- 範囲外のことは `## Assumptions` に「〜は範囲外」と書く（Issue の「やらないこと」になる）
- tasks のフェーズは、**1つの PR で終わる大きさ**にする（フェーズが1つの Issue になる）
- 分からないことは推測で埋めず `[NEEDS CLARIFICATION: …]` と書く。残っている間は Issue を起こさない

## やらないこと

- `/speckit-implement` で実装しない。実装は Issue から（Jules・Claude・人）、PR とレビューの段階を通す
- `/speckit-taskstoissues` は使わない（1タスク1 Issue になり、形が揺れる）。`scripts/spec/spec_to_issues.py` を使う
