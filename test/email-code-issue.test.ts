import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryMailSender } from "../src/mail/memory";
import type { MailSender } from "../src/mail/types";
import { hashCode } from "../src/verifiers/email-code/code";
import {
  CODE_TTL_SECONDS,
  hashDestination,
  issueCode,
} from "../src/verifiers/email-code/issue";

const KEY = "test-hash-key";
const EMAIL = "Someone@Example.org";
let now = 1_700_000_000;

const options = (mail: MailSender = new MemoryMailSender()) => ({
  db: env.DB,
  mail,
  hashKey: KEY,
  now: () => now,
});

type Row = Record<string, unknown>;
const rows = async (): Promise<Row[]> =>
  (await env.DB.prepare("SELECT * FROM email_codes").all<Row>()).results;

beforeEach(async () => {
  now = 1_700_000_000;
  await env.DB.prepare("DELETE FROM email_codes").run();
});

describe("issueCode", () => {
  it("email_codes に1行入り、メールの本文にコードが届く", async () => {
    const mail = new MemoryMailSender();
    const result = await issueCode(EMAIL, {
      ...options(mail),
      newCode: () => "042195",
    });
    expect(result).toMatchObject({
      ok: true,
      expiresAt: now + CODE_TTL_SECONDS,
    });

    const saved = await rows();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      destination_hash: await hashDestination(EMAIL, KEY),
      code_hash: await hashCode("042195", KEY),
      expires_at: now + 600,
      attempt_count: 0,
      consumed_at: null,
      created_at: now,
    });

    expect(mail.sent).toHaveLength(1);
    expect(mail.last()?.to).toBe("someone@example.org");
    expect(mail.last()?.text).toContain("042195");
  });

  it("email_codes に宛先とコードを平文で入れない", async () => {
    await issueCode(EMAIL, { ...options(), newCode: () => "777123" });
    const [row] = await rows();
    for (const value of Object.values(row)) {
      const text = String(value).toLowerCase();
      expect(text).not.toContain("someone@example.org");
      expect(text).not.toContain("777123");
    }
  });

  it("1分に2回目の発行は断る", async () => {
    expect((await issueCode(EMAIL, options())).ok).toBe(true);
    now += 30;
    expect(await issueCode(EMAIL, options())).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    // 大文字・小文字の違う同じ宛先も同じに数える
    expect(await issueCode("someone@example.org", options())).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    // 別の宛先は止めない
    expect((await issueCode("other@example.org", options())).ok).toBe(true);
    expect(await rows()).toHaveLength(2);
  });

  it("1時間に6回目の発行は断り、1時間たてば発行できる", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await issueCode(EMAIL, options())).ok).toBe(true);
      now += 61;
    }
    expect(await issueCode(EMAIL, options())).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    now = 1_700_000_000 + 3600;
    expect((await issueCode(EMAIL, options())).ok).toBe(true);
  });

  it("送信に失敗したら send_failed を返す", async () => {
    const failing: MailSender = {
      send: async () => ({ status: "failed" }),
    };
    expect(await issueCode(EMAIL, options(failing))).toEqual({
      ok: false,
      reason: "send_failed",
    });
  });
});
