import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import {
  DEFAULT_RETENTION,
  purgeExpired,
  retentionFromEnv,
} from "../src/retention";
import wranglerToml from "../wrangler.toml?raw";

const DAY = 86_400;
const NOW = 1_800_000_000;

const ids = async (table: string): Promise<string[]> =>
  (
    await env.DB.prepare(`SELECT id FROM ${table} ORDER BY id`).all<{
      id: string;
    }>()
  ).results.map((r) => r.id);

const event = (id: string, createdAt: number) =>
  env.DB.prepare(
    "INSERT INTO auth_events (id, event_type, service, result, created_at) VALUES (?, 'login', 'engawa', 'success', ?)",
  ).bind(id, createdAt);

const code = (id: string, expiresAt: number, consumedAt: number | null) =>
  env.DB.prepare(
    "INSERT INTO email_codes (id, destination_hash, code_hash, expires_at, consumed_at, created_at) VALUES (?, 'd', 'c', ?, ?, ?)",
  ).bind(id, expiresAt, consumedAt, expiresAt - 600);

const session = (id: string, expiresAt: number, revokedAt: number | null) =>
  env.DB.prepare(
    "INSERT INTO sessions (id, sub, service, amr, auth_time, created_at, last_active_at, expires_at, revoked_at) VALUES (?, 'p-1', 'engawa', 'email_code', 1, 1, 1, ?, ?)",
  ).bind(id, expiresAt, revokedAt);

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_events"),
    env.DB.prepare("DELETE FROM email_codes"),
    env.DB.prepare("DELETE FROM sessions"),
  ]);
});

describe("purgeExpired", () => {
  it("auth_events：記録から1年を過ぎた行が消え、期限内の行が残る", async () => {
    await env.DB.batch([
      event("old", NOW - 365 * DAY - 1),
      event("edge", NOW - 365 * DAY),
      event("new", NOW - DAY),
    ]);
    const result = await purgeExpired(env.DB, NOW);
    expect(result.authEvents).toBe(1);
    expect(await ids("auth_events")).toEqual(["edge", "new"]);
  });

  it("email_codes：期限切れか使ってから1日を過ぎた行が消え、ほかは残る", async () => {
    await env.DB.batch([
      code("expired-old", NOW - DAY - 1, null),
      code("consumed-old", NOW + 600, NOW - DAY - 1),
      code("expired-recent", NOW - 60, null),
      code("consumed-recent", NOW + 600, NOW - 60),
      code("live", NOW + 600, null),
    ]);
    const result = await purgeExpired(env.DB, NOW);
    expect(result.emailCodes).toBe(2);
    expect(await ids("email_codes")).toEqual([
      "consumed-recent",
      "expired-recent",
      "live",
    ]);
  });

  it("sessions：切れたか失効してから30日を過ぎた行が消え、ほかは残る", async () => {
    await env.DB.batch([
      session("expired-old", NOW - 30 * DAY - 1, null),
      session("revoked-old", NOW + DAY, NOW - 30 * DAY - 1),
      session("expired-recent", NOW - DAY, null),
      session("revoked-recent", NOW + DAY, NOW - DAY),
      session("live", NOW + DAY, null),
    ]);
    const result = await purgeExpired(env.DB, NOW);
    expect(result.sessions).toBe(2);
    expect(await ids("sessions")).toEqual([
      "expired-recent",
      "live",
      "revoked-recent",
    ]);
  });

  it("期限は設定の値で変えられる", async () => {
    await env.DB.batch([event("a", NOW - 8 * DAY), event("b", NOW - 6 * DAY)]);
    await purgeExpired(env.DB, NOW, {
      ...DEFAULT_RETENTION,
      authEventsDays: 7,
    });
    expect(await ids("auth_events")).toEqual(["b"]);
  });
});

describe("retentionFromEnv", () => {
  it("設定がなければ docs/data-retention.md の〔案〕の値", () => {
    expect(retentionFromEnv({})).toEqual({
      authEventsDays: 365,
      emailCodesDays: 1,
      sessionsDays: 30,
    });
  });

  it("設定の値を読む", () => {
    expect(
      retentionFromEnv({
        RETENTION_AUTH_EVENTS_DAYS: "90",
        RETENTION_EMAIL_CODES_DAYS: "2",
        RETENTION_SESSIONS_DAYS: "7",
      }),
    ).toEqual({ authEventsDays: 90, emailCodesDays: 2, sessionsDays: 7 });
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "%s のような値は例外で止める（消しすぎないように）",
    (value) => {
      expect(() =>
        retentionFromEnv({ RETENTION_SESSIONS_DAYS: value }),
      ).toThrow(/RETENTION_SESSIONS_DAYS/);
    },
  );
});

describe("Cron Trigger", () => {
  it("wrangler.toml に Cron の設定がある", () => {
    expect(wranglerToml).toMatch(/^\[triggers\]\ncrons = \["[^"]+"\]$/m);
  });

  it("scheduled から期限を過ぎた行を消す", async () => {
    await env.DB.batch([
      event("old", NOW - 400 * DAY),
      event("new", NOW - DAY),
    ]);
    const controller = createScheduledController({
      scheduledTime: NOW * 1000,
      cron: "30 18 * * *",
    });
    const ctx = createExecutionContext();
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await ids("auth_events")).toEqual(["new"]);
  });
});
