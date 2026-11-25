import { describe, expect, it } from "vitest";
import { MemoryMailSender } from "../src/mail/memory";
import type { MailSender } from "../src/mail/types";

describe("MemoryMailSender", () => {
  it("送った内容を取り出せる", async () => {
    const sender = new MemoryMailSender();
    const mailSender: MailSender = sender;
    const message = {
      to: "user@example.com",
      subject: "確認コード",
      text: "確認コードは 012345 です。",
    };

    const result = await mailSender.send(message);

    expect(result).toEqual({ status: "accepted" });
    expect(sender.sent).toEqual([message]);
    expect(sender.last()).toEqual(message);
  });

  it("送った順に残る", async () => {
    const sender = new MemoryMailSender();
    await sender.send({ to: "a@example.com", subject: "1", text: "1" });
    await sender.send({ to: "b@example.com", subject: "2", text: "2" });
    expect(sender.sent.map((m) => m.to)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("送る前は何も残っていない", () => {
    const sender = new MemoryMailSender();
    expect(sender.sent).toEqual([]);
    expect(sender.last()).toBeUndefined();
  });
});
