---
description: "Task list"
---

# Tasks: 集会所の予約

**Input**: Design documents from `/specs/001-booking/`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workers と D1 の雛形

- [x] T001 Create project structure per implementation plan
- [ ] T002 [P] Configure biome

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 予約の表と、会員の認証の土台

- [ ] T003 Create reservations table in db/migrations/0001_reservations.sql
- [ ] T004 [P] Wire Tenkyu session check in src/auth/session.ts

**Checkpoint**: 認証済みの会員として API を呼べる

---

## Phase 3: User Story 1 - 空いている枠を見て予約する (Priority: P1) 🎯 MVP

**Goal**: 会員が空き枠を予約できる

**Independent Test**: 会員のアカウントで空き枠を1つ予約し、一覧に出る

### Implementation for User Story 1

- [ ] T005 [P] [US1] Implement slot query in src/slots/query.ts
- [ ] T006 [US1] Implement reserve command in src/reservations/reserve.ts (depends on T005)

**Checkpoint**: User Story 1 が単独で動く

---

## Phase 4: User Story 2 - 予約を取り消す (Priority: P2)

**Goal**: 会員が自分の予約を取り消せる

- [ ] T007 [US2] Implement cancel command in src/reservations/cancel.ts

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T008 [P] Documentation updates in docs/

---

## Dependencies & Execution Order

- Setup → Foundational → User Stories → Polish
- [ ] T999 これは依存の節なのでタスクとして読まない
