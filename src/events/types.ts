/** 認証の記録に残す出来事の種類（docs/events.md の「出来事の種類」と同じ一覧）。 */
export const EVENT_TYPES = [
  "code_issue",
  "code_send",
  "code_verify",
  "login",
  "logout",
  "session_revoke",
  "session_limit_exceeded",
  "session_timeout",
  "admin_action",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 記録に残す認証の手段。 */
export type EventMethod = "email_code" | "passkey" | "firebase";

/** 記録の結果。 */
export type EventResult = "success" | "failure";

/**
 * 認証の記録の1件。メールアドレスやコードなどの入力の値を入れる項目は置かない（docs/events.md）。
 */
export type AuthEvent = {
  type: EventType;
  /** 主体の ID。特定できる前は持たない */
  principalId?: string;
  service: string;
  method?: EventMethod;
  result: EventResult;
  /** 起きた時刻（UNIX エポック秒） */
  occurredAt: number;
};
