import { env } from "cloudflare:test";
import { Hono } from "hono";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACCESS_JWT_HEADER, accessAuth } from "../src/admin/access";
import { adminHostOnly } from "../src/admin/host";
import { principalSearchRoutes } from "../src/admin/principals";
import { link } from "../src/identities/index";
import { hashCode } from "../src/verifiers/email-code/code";

const TEAM = "https://example.cloudflareaccess.com";
const AUD = "aud-tag-1";
const ADMIN_HOST = "admin.tenkyu.example";
const KEY = "test-hash-key";
const NOW = 1_700_000_000;

let token: string;
let app: Hono;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "access-1" };
  token = await new SignJWT({ email: "operator@example.org" })
    .setProtectedHeader({ alg: "RS256", kid: "access-1" })
    .setIssuer(TEAM)
    .setAudience(AUD)
    .setSubject("operator-1")
    .setIssuedAt(NOW)
    .setExpirationTime(NOW + 600)
    .sign(keys.privateKey);

  // 本番と同じく、ホスト名と JWT の確かめを前に付けて載せる
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
  app.route("/admin/api", principalSearchRoutes({ hashKey: KEY }));
});

const search = (query: string, headers: Record<string, string> = {}) =>
  app.request(
    `https://${ADMIN_HOST}/admin/api/principals?${query}`,
    { headers: { [ACCESS_JWT_HEADER]: token, ...headers } },
    { DB: env.DB, ADMIN_HOST },
  );

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM identities").run();
  const opts = { now: () => NOW };
  await link(env.DB, "p-1", "firebase", "uid-1", opts);
  await link(
    env.DB,
    "p-1",
    "email_code",
    await hashCode("alice@example.org", KEY),
    opts,
  );
  await link(env.DB, "p-2", "firebase", "uid-2", opts);
});

describe("GET /admin/api/principals", () => {
  it("内部の ID で見つかる", async () => {
    const res = await search("id=p-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      principals: [
        {
          id: "p-1",
          identities: [
            { provider: "email_code", created_at: NOW, disabled_at: null },
            { provider: "firebase", created_at: NOW, disabled_at: null },
          ],
        },
      ],
    });
  });

  it("メールアドレスで見つかる（大文字・前後の空白は同じに扱う）", async () => {
    const res = await search(
      `email=${encodeURIComponent(" Alice@Example.org ")}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ principals: { id: string }[] }>();
    expect(body.principals.map((p) => p.id)).toEqual(["p-1"]);
  });

  it("見つからないときは空の結果を返す", async () => {
    for (const query of ["id=no-such", "email=nobody%40example.org"]) {
      const res = await search(query);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ principals: [] });
    }
  });

  it("返す中身に識別子（メールアドレスのハッシュ、uid）を含めない", async () => {
    const text = await (await search("id=p-1")).text();
    expect(text).not.toContain(await hashCode("alice@example.org", KEY));
    expect(text).not.toContain("uid-1");
  });

  it("id と email のどちらもない、または両方あるときは 400", async () => {
    expect((await search("")).status).toBe(400);
    expect((await search("id=p-1&email=a%40b.c")).status).toBe(400);
  });

  it("JWT がなければ 401", async () => {
    const res = await app.request(
      `https://${ADMIN_HOST}/admin/api/principals?id=p-1`,
      {},
      { DB: env.DB, ADMIN_HOST },
    );
    expect(res.status).toBe(401);
  });
});
