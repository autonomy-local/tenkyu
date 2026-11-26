import { Hono } from "hono";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_JWT_HEADER,
  type AccessVariables,
  accessAuth,
} from "../src/admin/access";

const TEAM = "https://example.cloudflareaccess.com";
const AUD = "aud-tag-1";
const NOW = 1_700_000_000;

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let trusted: KeyPair;
let untrusted: KeyPair;
let app: Hono<{ Variables: AccessVariables }>;

beforeAll(async () => {
  trusted = await generateKeyPair("RS256", { extractable: true });
  untrusted = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(trusted.publicKey)), kid: "access-1" };
  app = new Hono<{ Variables: AccessVariables }>();
  app.use(
    "/admin/*",
    accessAuth({
      teamDomain: TEAM,
      aud: AUD,
      getKey: createLocalJWKSet({ keys: [jwk] }),
      now: () => NOW * 1000,
    }),
  );
  app.get("/admin/me", (c) => c.json(c.get("accessIdentity")));
});

const sign = (
  overrides: JWTPayload = {},
  privateKey: CryptoKey = trusted.privateKey,
) =>
  new SignJWT({
    iss: TEAM,
    aud: [AUD],
    sub: "operator-1",
    email: "operator@example.com",
    iat: NOW - 60,
    exp: NOW + 3600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "access-1" })
    .sign(privateKey);

const get = (token?: string) =>
  app.request(
    "/admin/me",
    token ? { headers: { [ACCESS_JWT_HEADER]: token } } : {},
  );

describe("accessAuth", () => {
  it("正しい JWT なら次の処理に sub とメールアドレスが渡る", async () => {
    const res = await get(await sign());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sub: "operator-1",
      email: "operator@example.com",
    });
  });

  it("JWT がなければ 401", async () => {
    expect((await get()).status).toBe(401);
  });

  it("署名が違えば 403", async () => {
    expect((await get(await sign({}, untrusted.privateKey))).status).toBe(403);
  });

  it("aud が違えば 403", async () => {
    expect((await get(await sign({ aud: ["other-aud"] }))).status).toBe(403);
  });

  it("iss が違えば 403", async () => {
    expect(
      (await get(await sign({ iss: "https://other.cloudflareaccess.com" })))
        .status,
    ).toBe(403);
  });

  it("期限が過ぎていれば 403", async () => {
    expect((await get(await sign({ exp: NOW - 1 }))).status).toBe(403);
  });

  it("形の崩れた JWT は 403", async () => {
    expect((await get("not-a-jwt")).status).toBe(403);
  });
});
