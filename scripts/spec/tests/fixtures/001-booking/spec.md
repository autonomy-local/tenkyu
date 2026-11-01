# Feature Specification: 集会所の予約

**Feature Branch**: `001-booking`

**Created**: 2026-11-01

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 空いている枠を見て予約する (Priority: P1)

自治会の会員が、集会所の空いている時間枠を見て、その場で予約できる。

**Why this priority**: 予約の電話を受ける役員の負担が一番大きいため。

**Independent Test**: 会員のアカウントで空き枠を1つ予約し、一覧に自分の予約が出ることで確かめられる。

**Acceptance Scenarios**:

1. **Given** 空いている枠がある, **When** 会員がその枠を予約する, **Then** 枠は埋まり、会員の予約一覧に出る
2. **Given** ほかの会員が同じ枠を先に予約した, **When** 会員が予約を確定する, **Then** 予約できない旨が表示され、枠は二重にならない

---

### User Story 2 - 予約を取り消す (Priority: P2)

会員が自分の予約を取り消せる。

**Why this priority**: 取り消しの連絡も役員の負担になっているため。

**Independent Test**: 予約を1つ取り消し、枠が空きに戻ることで確かめられる。

**Acceptance Scenarios**:

1. **Given** 会員の予約がある, **When** 会員が取り消す, **Then** 枠は空きに戻る
2. **Given** 利用日の前日を過ぎている, **When** 会員が取り消そうとする, **Then** [NEEDS CLARIFICATION: 前日を過ぎた取り消しを受けるか、役員の承認にするか]

---

### Edge Cases

- 同じ会員が同じ時間に2つの部屋を予約しようとしたとき
- 電波が切れた状態で予約を確定しようとしたとき

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 枠の二重予約を防ぐ
- **FR-002**: System MUST 予約と取り消しの記録を残す
- **FR-003**: System MUST 前日を過ぎた取り消しを [NEEDS CLARIFICATION: 扱いが未定]

## Success Criteria *(mandatory)*

- **SC-001**: 予約の電話が月 10 件以下になる

## Assumptions

- 会員はスマートフォンを持っている
- 料金の支払いは範囲外（v1 では扱わない）
- 役員による代理の予約は対象外
