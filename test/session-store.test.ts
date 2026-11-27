import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "../src/contract";
import { SessionStore } from "../src/sessions/store";
import { hashSessionId } from "../src/sessions/token";

let now = 1_700_000_000;
const store = () => new SessionStore(env.DB, { now: () => now });

const input = {
  sub: "p-1",
  service: "engawa",
  amr: "email_code",
  authTime: 1_700_000_000,
  ttlSeconds: 3600,
} as const;

beforeEach(async () => {
  now = 1_700_000_000;
  await env.DB.prepare("DELETE FROM sessions").run();
});

describe("SessionStore", () => {
  it("作成→検証→ログアウト→検証の失敗", async () => {
    const created = await store().create(input);
    expect(created.expiresAt).toBe(now + 3600);

    expect(await store().verify(created.token, "engawa")).toEqual({
      valid: true,
      sub: "p-1",
      service: "engawa",
      amr: "email_code",
      auth_time: 1_700_000_000,
      expires_at: now + 3600,
      version: CONTRACT_VERSION,
    });

    expect(await store().logout(created.token, "engawa")).toEqual({
      revoked: true,
      version: CONTRACT_VERSION,
    });
    expect(await store().verify(created.token, "engawa")).toEqual({
      valid: false,
      reason: "revoked",
      version: CONTRACT_VERSION,
    });
    // 2度目のログアウトは失効させるものがない
    expect((await store().logout(created.token, "engawa")).revoked).toBe(false);
  });

  it("期限を過ぎたセッションは expired", async () => {
    const created = await store().create(input);
    now += 3600;
    expect(await store().verify(created.token, "engawa")).toEqual({
      valid: false,
      reason: "expired",
      version: CONTRACT_VERSION,
    });
  });

  it("失効させたセッションは revoked", async () => {
    const created = await store().create(input);
    expect(await store().revoke(created.id)).toBe(true);
    expect(await store().verify(created.token, "engawa")).toMatchObject({
      valid: false,
      reason: "revoked",
    });
    expect(await store().revoke(created.id)).toBe(false);
  });

  it("知らないトークン、空のトークン、別のサービスは unknown", async () => {
    const created = await store().create(input);
    for (const [token, service] of [
      ["no-such-token", "engawa"],
      ["", "engawa"],
      [created.token, "bunko"],
    ]) {
      expect(await store().verify(token, service)).toEqual({
        valid: false,
        reason: "unknown",
        version: CONTRACT_VERSION,
      });
    }
    // 別のサービスからはログアウトさせられない
    expect((await store().logout(created.token, "bunko")).revoked).toBe(false);
  });

  it("sessions にトークンを平文で入れない", async () => {
    const created = await store().create(input);
    const rows = (
      await env.DB.prepare("SELECT * FROM sessions").all<
        Record<string, unknown>
      >()
    ).results;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(await hashSessionId(created.token));
    expect(created.id).toBe(rows[0].id);
    for (const value of Object.values(rows[0])) {
      expect(String(value)).not.toContain(created.token);
    }
  });
});
