import type { AuthEvent } from "./types";

export type RecordEventOptions = {
  /** 記録の ID を作る関数。既定は UUIDv4 */
  newId?: () => string;
};

/**
 * 認証の記録を auth_events に1行入れる（docs/events.md、docs/schema.md の 3.）。
 * AuthEvent には入力の値（メールアドレス、コード）の項目がないので、ここでも入らない。
 */
export const recordEvent = async (
  db: D1Database,
  event: AuthEvent,
  options: RecordEventOptions = {},
): Promise<string> => {
  const id = (options.newId ?? (() => crypto.randomUUID()))();
  await db
    .prepare(
      "INSERT INTO auth_events (id, event_type, sub, service, amr, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      event.type,
      event.principalId ?? null,
      event.service,
      event.method ?? null,
      event.result,
      event.occurredAt,
    )
    .run();
  return id;
};
