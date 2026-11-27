import { recordEvent } from "../events/record";
import { MemoryMailSender } from "./memory";
import { ResendMailSender } from "./resend";
import type { MailMessage, MailSender, SendResult } from "./types";

/** 送信の中身の名前。Cloudflare のメールの中身は、足すときにここに足す */
export const MAILERS = ["resend", "memory"] as const;
export type Mailer = (typeof MAILERS)[number];

/** 送信の中身を選ぶのに使う設定（Workers の vars と秘密の値） */
export type MailEnv = {
  MAILER?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};

/**
 * 設定の `MAILER` から送信の中身を選ぶ。`resend` は Resend の API で送り、`memory` は送らずに残すだけ（手元とテスト用）。
 * 知らない値や空のときは、黙って送らない中身に倒さず、例外で止める。
 */
export const selectMailSender = (env: MailEnv): MailSender => {
  switch (env.MAILER) {
    case "resend":
      if (!env.MAIL_FROM) throw new Error("MAIL_FROM が空です");
      return ResendMailSender.fromEnv({
        RESEND_API_KEY: env.RESEND_API_KEY ?? "",
        MAIL_FROM: env.MAIL_FROM,
      });
    case "memory":
      return new MemoryMailSender();
    default:
      throw new Error(
        `MAILER の値が知らないものです（使える値：${MAILERS.join("、")}）`,
      );
  }
};

export type RecordingOptions = {
  db: D1Database;
  /** 送信を求めたサービス（auth_events の service） */
  service: string;
  /** 今の時刻（UNIX エポック秒）。既定は Date.now() */
  now?: () => number;
};

/**
 * 送ったあとに、結果を auth_events に `code_send` として残す包み（docs/events.md）。
 * 記録には宛先・件名・本文を入れない（入るのは種類、サービス、手段、結果、時刻だけ）。
 */
export class RecordingMailSender implements MailSender {
  constructor(
    private readonly inner: MailSender,
    private readonly options: RecordingOptions,
  ) {}

  async send(message: MailMessage): Promise<SendResult> {
    const result = await this.inner.send(message);
    await recordEvent(this.options.db, {
      type: "code_send",
      service: this.options.service,
      method: "email_code",
      result: result.status === "accepted" ? "success" : "failure",
      occurredAt: (this.options.now ?? (() => Math.floor(Date.now() / 1000)))(),
    });
    return result;
  }
}
