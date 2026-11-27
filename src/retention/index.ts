/**
 * 期限を過ぎた記録・コード・セッションを消す（docs/data-retention.md の「データごとの期限」、次-8b）。
 * Cron Trigger（src/index.ts の scheduled）から1日に1回呼ぶ。消した行は戻せない（D1 の Time Travel の間を除く）。
 */

const DAY = 24 * 60 * 60;

/** 消すまでの日数。docs/data-retention.md の〔案〕の値を既定にする */
export type RetentionConfig = {
  /** auth_events：記録してから */
  authEventsDays: number;
  /** email_codes：有効期限を過ぎたか使ったあと */
  emailCodesDays: number;
  /** sessions：切れたか失効したあと */
  sessionsDays: number;
};

export const DEFAULT_RETENTION: RetentionConfig = {
  authEventsDays: 365,
  emailCodesDays: 1,
  sessionsDays: 30,
};

/** 設定（Workers の vars）の名前。どれも任意で、ないときは既定の値を使う */
export type RetentionEnv = {
  RETENTION_AUTH_EVENTS_DAYS?: string;
  RETENTION_EMAIL_CODES_DAYS?: string;
  RETENTION_SESSIONS_DAYS?: string;
};

const parseDays = (
  name: string,
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined || value.trim() === "") return fallback;
  const days = Number(value);
  // 0 や負の値、数でない値で、消してはいけない行まで消さないように止める
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`${name} は1以上の整数（日数）にしてください`);
  }
  return days;
};

/** 設定から期限を読む。値がおかしいときは例外で止める */
export const retentionFromEnv = (env: RetentionEnv): RetentionConfig => ({
  authEventsDays: parseDays(
    "RETENTION_AUTH_EVENTS_DAYS",
    env.RETENTION_AUTH_EVENTS_DAYS,
    DEFAULT_RETENTION.authEventsDays,
  ),
  emailCodesDays: parseDays(
    "RETENTION_EMAIL_CODES_DAYS",
    env.RETENTION_EMAIL_CODES_DAYS,
    DEFAULT_RETENTION.emailCodesDays,
  ),
  sessionsDays: parseDays(
    "RETENTION_SESSIONS_DAYS",
    env.RETENTION_SESSIONS_DAYS,
    DEFAULT_RETENTION.sessionsDays,
  ),
});

export type PurgeResult = {
  authEvents: number;
  emailCodes: number;
  sessions: number;
};

/** 期限を過ぎた行を3つの表から消し、消した行の数を返す。`now` は UNIX エポック秒 */
export const purgeExpired = async (
  db: D1Database,
  now: number,
  config: RetentionConfig = DEFAULT_RETENTION,
): Promise<PurgeResult> => {
  const [authEvents, emailCodes, sessions] = await db.batch([
    db
      .prepare("DELETE FROM auth_events WHERE created_at < ?")
      .bind(now - config.authEventsDays * DAY),
    db
      .prepare(
        "DELETE FROM email_codes WHERE expires_at < ?1 OR (consumed_at IS NOT NULL AND consumed_at < ?1)",
      )
      .bind(now - config.emailCodesDays * DAY),
    db
      .prepare(
        "DELETE FROM sessions WHERE expires_at < ?1 OR (revoked_at IS NOT NULL AND revoked_at < ?1)",
      )
      .bind(now - config.sessionsDays * DAY),
  ]);
  return {
    authEvents: authEvents.meta.changes,
    emailCodes: emailCodes.meta.changes,
    sessions: sessions.meta.changes,
  };
};
