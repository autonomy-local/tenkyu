import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import deployDoc from "../docs/deploy.md?raw";
import { RecordingMailSender, selectMailSender } from "../src/mail/index";
import { MemoryMailSender } from "../src/mail/memory";
import { ResendMailSender } from "../src/mail/resend";
import type { MailSender } from "../src/mail/types";

const TO = "someone@example.org";
const message = {
  to: TO,
  subject: "確認コード",
  text: "確認コードは 123456 です",
};

describe("selectMailSender", () => {
  it("MAILER=resend なら Resend の中身", () => {
    expect(
      selectMailSender({
        MAILER: "resend",
        RESEND_API_KEY: "re_test",
        MAIL_FROM: "Tenkyu <no-reply@example.org>",
      }),
    ).toBeInstanceOf(ResendMailSender);
  });

  it("MAILER=memory なら送らずに残す中身", () => {
    expect(selectMailSender({ MAILER: "memory" })).toBeInstanceOf(
      MemoryMailSender,
    );
  });

  it.each([
    ["知らない値", { MAILER: "smtp" }],
    ["未設定", {}],
    ["Resend で API キーがない", { MAILER: "resend", MAIL_FROM: "a@b.c" }],
    ["Resend で差出人がない", { MAILER: "resend", RESEND_API_KEY: "re_test" }],
  ])("%sのときは例外で止める", (_label, value) => {
    expect(() => selectMailSender(value)).toThrow();
  });
});

type Row = Record<string, unknown>;
const rows = async (): Promise<Row[]> =>
  (await env.DB.prepare("SELECT * FROM auth_events").all<Row>()).results;

describe("RecordingMailSender", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM auth_events").run();
  });

  it("送信に成功したら code_send の success を残す", async () => {
    const inner = new MemoryMailSender();
    const sender = new RecordingMailSender(inner, {
      db: env.DB,
      service: "engawa",
      now: () => 1_700_000_000,
    });
    expect(await sender.send(message)).toEqual({ status: "accepted" });
    expect(inner.sent).toHaveLength(1);
    expect(await rows()).toEqual([
      expect.objectContaining({
        event_type: "code_send",
        sub: null,
        service: "engawa",
        amr: "email_code",
        result: "success",
        created_at: 1_700_000_000,
      }),
    ]);
  });

  it("送信に失敗したら code_send の failure を残す", async () => {
    const failing: MailSender = { send: async () => ({ status: "failed" }) };
    const sender = new RecordingMailSender(failing, {
      db: env.DB,
      service: "bunko",
    });
    expect(await sender.send(message)).toEqual({ status: "failed" });
    expect(await rows()).toEqual([
      expect.objectContaining({ event_type: "code_send", result: "failure" }),
    ]);
  });

  it("記録に宛先・本文・コードが含まれない", async () => {
    const sender = new RecordingMailSender(new MemoryMailSender(), {
      db: env.DB,
      service: "engawa",
    });
    await sender.send(message);
    const text = JSON.stringify(await rows());
    expect(text).not.toContain(TO);
    expect(text).not.toContain("123456");
    expect(text).not.toContain("@");
  });
});

describe("docs/deploy.md", () => {
  it("Resend の設定の手順がある", () => {
    expect(deployDoc).toContain("#### メールの送信（Resend）");
    for (const name of ["MAILER", "RESEND_API_KEY", "MAIL_FROM"]) {
      expect(deployDoc).toContain(name);
    }
  });
});
