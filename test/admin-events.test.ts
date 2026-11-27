import { env } from "cloudflare:test";
import { Hono } from "hono";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACCESS_JWT_HEADER, accessAuth } from "../src/admin/access";
import {
  EVENTS_DEFAULT_LIMIT,
  EVENTS_MAX_LIMIT,
  principalEventsRoutes,
} from "../src/admin/events";
import { adminHostOnly } from "../src/admin/host";
import { recordEvent } from "../src/events/record";

const TEAM = "https://example.cloudflareaccess.com";
const AUD = "aud-tag-1";
const ADMIN_HOST = "admin.tenkyu.example";
const NOW = 1_700_000_000;

let token: string;
let foreignToken: string;
let app: Hono;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "access-1" };
  const sign = (key: CryptoKey) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "access-1" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setSubject("operator-1")
      .setIssuedAt(NOW)
      .setExpirationTime(NOW + 600)
      .sign(key);
  token = await sign(keys.privateKey);
  foreignToken = await sign(other.privateKey);

  app = new Hono();
  app.use(
    "/admin/api/*",
    adminHostOnly(),
    accessAuth({
      teamDomain: TEAM,
      aud: AUD,
      getKey: createLocalJWKSet({ keys: [jwk] }),
      now: () => NOW * 1000,
    }),
  );
  app.route("/admin/api", principalEventsRoutes());
});

const get = (path: string, jwt = token) =>
  app.request(
    `https://${ADMIN_HOST}/admin/api${path}`,
    { headers: { [ACCESS_JWT_HEADER]: jwt } },
    { DB: env.DB, ADMIN_HOST },
  );

type Body = { events: { id: string; created_at: number }[]; limit: number };

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM auth_events").run();
});

const seed = async (sub: string, count: number, prefix: string) => {
  for (let i = 0; i < count; i++) {
    await recordEvent(
      env.DB,
      {
        type: "login",
        principalId: sub,
        service: "engawa",
        method: "email_code",
        result: "success",
        occurredAt: NOW + i,
      },
      { newId: () => `${prefix}-${String(i).padStart(3, "0")}` },
    );
  }
};

describe("GET /admin/api/principals/:id/events", () => {
  it("正しい JWT で、その主体の記録だけが新しい順に返る", async () => {
    await seed("p-1", 3, "a");
    await seed("p-2", 2, "b");
    const res = await get("/principals/p-1/events");
    expect(res.status).toBe(200);
    const body = await res.json<Body>();
    expect(body.events.map((e) => e.id)).toEqual(["a-002", "a-001", "a-000"]);
    expect(body.events[0]).toEqual({
      id: "a-002",
      event_type: "login",
      service: "engawa",
      amr: "email_code",
      result: "success",
      created_at: NOW + 2,
    });
  });

  it("件数の上限が効く", async () => {
    await seed("p-1", EVENTS_MAX_LIMIT + 5, "a");
    const limited = await (
      await get("/principals/p-1/events?limit=2")
    ).json<Body>();
    expect(limited.events.map((e) => e.id)).toEqual(["a-204", "a-203"]);

    const byDefault = await (await get("/principals/p-1/events")).json<Body>();
    expect(byDefault.events).toHaveLength(EVENTS_DEFAULT_LIMIT);

    const tooMany = await (
      await get("/principals/p-1/events?limit=10000")
    ).json<Body>();
    expect(tooMany.events).toHaveLength(EVENTS_MAX_LIMIT);
    expect(tooMany.limit).toBe(EVENTS_MAX_LIMIT);
  });

  it("記録のない主体は空の配列", async () => {
    expect(await (await get("/principals/none/events")).json()).toEqual({
      events: [],
      limit: EVENTS_DEFAULT_LIMIT,
    });
  });

  it("JWT がない・署名が違うときは返さない", async () => {
    await seed("p-1", 1, "a");
    const missing = await app.request(
      `https://${ADMIN_HOST}/admin/api/principals/p-1/events`,
      {},
      { DB: env.DB, ADMIN_HOST },
    );
    expect(missing.status).toBe(401);
    expect((await get("/principals/p-1/events", foreignToken)).status).toBe(
      403,
    );
  });
});
