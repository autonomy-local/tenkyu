import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { recordEvent } from "../src/events/record";
import { EVENT_TYPES } from "../src/events/types";

type Row = {
  id: string;
  event_type: string;
  sub: string | null;
  service: string;
  amr: string | null;
  result: string;
  created_at: number;
};

const rows = async (): Promise<Row[]> =>
  (
    await env.DB.prepare(
      "SELECT id, event_type, sub, service, amr, result, created_at FROM auth_events ORDER BY created_at, event_type",
    ).all<Row>()
  ).results;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM auth_events").run();
});

describe("recordEvent", () => {
  it.each(EVENT_TYPES)("%s の記録が auth_events に入る", async (type) => {
    const id = await recordEvent(env.DB, {
      type,
      principalId: "p-1",
      service: "engawa",
      method: "email_code",
      result: "success",
      occurredAt: 1_700_000_000,
    });
    expect(await rows()).toEqual([
      {
        id,
        event_type: type,
        sub: "p-1",
        service: "engawa",
        amr: "email_code",
        result: "success",
        created_at: 1_700_000_000,
      },
    ]);
  });

  it("主体の ID と手段のない出来事も記録できる", async () => {
    await recordEvent(
      env.DB,
      {
        type: "code_verify",
        service: "bunko",
        result: "failure",
        occurredAt: 1_700_000_100,
      },
      { newId: () => "e-1" },
    );
    expect(await rows()).toEqual([
      {
        id: "e-1",
        event_type: "code_verify",
        sub: null,
        service: "bunko",
        amr: null,
        result: "failure",
        created_at: 1_700_000_100,
      },
    ]);
  });

  it("記録ごとに別の ID が付く", async () => {
    const event = {
      type: "login",
      service: "engawa",
      result: "success",
      occurredAt: 1,
    } as const;
    const a = await recordEvent(env.DB, event);
    const b = await recordEvent(env.DB, event);
    expect(a).not.toBe(b);
    expect(await rows()).toHaveLength(2);
  });
});
