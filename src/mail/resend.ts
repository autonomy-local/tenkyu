import { log } from "../log";
import type { MailMessage, MailSender, SendResult } from "./types";

/** Resend の送信の API */
export const RESEND_API_URL = "https://api.resend.com/emails";

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type ResendOptions = {
  /** Workers の秘密の値 `RESEND_API_KEY` */
  apiKey: string;
  /** 差出人（例：`Tenkyu <no-reply@example.org>`） */
  from: string;
  /** テストで差し替える fetch */
  fetch?: Fetch;
};

/** Resend の API を fetch で呼んで送る中身。 */
export class ResendMailSender implements MailSender {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetch: Fetch;

  constructor(options: ResendOptions) {
    if (options.apiKey === "") throw new Error("RESEND_API_KEY が空です");
    this.apiKey = options.apiKey;
    this.from = options.from;
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  static fromEnv(
    env: { RESEND_API_KEY: string; MAIL_FROM: string },
    fetchImpl?: Fetch,
  ): ResendMailSender {
    return new ResendMailSender({
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
      fetch: fetchImpl,
    });
  }

  async send(message: MailMessage): Promise<SendResult> {
    let response: Response;
    try {
      response = await this.fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
    } catch {
      // 宛先・本文・API キーはログに出さない（docs/events.md）
      log("error", {
        event: "code_send",
        result: "failure",
        reason: "network",
      });
      return { status: "failed" };
    }
    if (!response.ok) {
      log("error", {
        event: "code_send",
        result: "failure",
        reason: `resend_http_${response.status}`,
      });
      return { status: "failed" };
    }
    return { status: "accepted" };
  }
}
