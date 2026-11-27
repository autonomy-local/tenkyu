import type { MailSender } from "../../mail/types";
import { generateCode, hashCode } from "./code";

/** コードの有効期限（秒）。10分 */
export const CODE_TTL_SECONDS = 10 * 60;

/** 同じ宛先への発行の頻度の制限。窓（秒）ごとの上限の回数 */
export const ISSUE_RATE_LIMITS = [
  { windowSeconds: 60, max: 1 },
  { windowSeconds: 60 * 60, max: 5 },
] as const;

export type IssueCodeOptions = {
  db: D1Database;
  mail: MailSender;
  /** 宛先とコードの鍵つきハッシュの鍵（Workers の秘密の値） */
  hashKey: string;
  /** 今の時刻（UNIX エポック秒）。既定は Date.now() */
  now?: () => number;
  /** 行の ID を作る関数。既定は UUIDv4 */
  newId?: () => string;
  /** コードを作る関数。既定は generateCode */
  newCode?: () => string;
};

export type IssueCodeResult =
  | { ok: true; id: string; expiresAt: number }
  | { ok: false; reason: "rate_limited" | "send_failed" };

/** 宛先（メールアドレス）を比べられる形にそろえる。前後の空白を除き、小文字にする */
export const normalizeDestination = (email: string): string =>
  email.trim().toLowerCase();

/** 宛先の鍵つきハッシュ。email_codes の destination_hash に入れる値 */
export const hashDestination = (email: string, key: string): Promise<string> =>
  hashCode(normalizeDestination(email), key);

/**
 * 確認コードを発行する。宛先とコードはハッシュにして email_codes に期限つきで置き、
 * 平文のコードはメールの本文にだけ入れる。宛先とコードはログに出さない（docs/events.md）。
 */
export const issueCode = async (
  email: string,
  options: IssueCodeOptions,
): Promise<IssueCodeResult> => {
  const now = (options.now ?? (() => Math.floor(Date.now() / 1000)))();
  const destinationHash = await hashDestination(email, options.hashKey);

  for (const limit of ISSUE_RATE_LIMITS) {
    const row = await options.db
      .prepare(
        "SELECT COUNT(*) AS n FROM email_codes WHERE destination_hash = ? AND created_at > ?",
      )
      .bind(destinationHash, now - limit.windowSeconds)
      .first<{ n: number }>();
    if ((row?.n ?? 0) >= limit.max)
      return { ok: false, reason: "rate_limited" };
  }

  const code = (options.newCode ?? generateCode)();
  const id = (options.newId ?? (() => crypto.randomUUID()))();
  const expiresAt = now + CODE_TTL_SECONDS;
  await options.db
    .prepare(
      "INSERT INTO email_codes (id, destination_hash, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      destinationHash,
      await hashCode(code, options.hashKey),
      expiresAt,
      now,
    )
    .run();

  const sent = await options.mail.send({
    to: normalizeDestination(email),
    subject: "ログインの確認コード",
    text: `確認コードは ${code} です。\n${CODE_TTL_SECONDS / 60}分のあいだ使えます。心当たりがなければ、このメールは捨ててください。`,
  });
  if (sent.status !== "accepted") return { ok: false, reason: "send_failed" };
  return { ok: true, id, expiresAt };
};
