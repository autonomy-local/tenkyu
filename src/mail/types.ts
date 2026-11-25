/** 送るメール。本文はテキストだけ（HTML のメールは扱わない）。 */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

/** 送信の結果。受け付けた（accepted）か、失敗した（failed）か。 */
export type SendResult = { status: "accepted" } | { status: "failed" };

/**
 * メールの送信の差し込み口。中身（Resend、Cloudflare のメールなど）を差し替えられるように、
 * 送信の手段に固有の項目は持たない。
 */
export interface MailSender {
  send(message: MailMessage): Promise<SendResult>;
}
