import type { MailMessage, MailSender, SendResult } from "./types";

/** テスト用の中身。送った内容を配列に残すだけで、外には送らない。 */
export class MemoryMailSender implements MailSender {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<SendResult> {
    this.sent.push({ ...message });
    return { status: "accepted" };
  }

  /** 最後に送った内容。まだ送っていなければ undefined。 */
  last(): MailMessage | undefined {
    return this.sent.at(-1);
  }
}
