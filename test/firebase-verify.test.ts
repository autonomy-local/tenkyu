import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyFirebaseIdToken } from "../src/verifiers/firebase/verify";

const PROJECT_ID = "tenkyu-test";
const NOW = 1_700_000_000;

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let trusted: KeyPair;
let untrusted: KeyPair;
let keys: { getKey(): Promise<ReturnType<typeof createLocalJWKSet>> };

beforeAll(async () => {
  trusted = await generateKeyPair("RS256", { extractable: true });
  untrusted = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(trusted.publicKey)), kid: "key-1" };
  const getKey = createLocalJWKSet({ keys: [jwk] });
  keys = { getKey: async () => getKey };
});

const sign = (
  overrides: JWTPayload = {},
  privateKey: CryptoKey = trusted.privateKey,
) =>
  new SignJWT({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: "uid-1",
    iat: NOW - 60,
    exp: NOW + 3600,
    auth_time: NOW - 120,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "key-1" })
    .sign(privateKey);

const verify = (token: string) =>
  verifyFirebaseIdToken(token, {
    projectId: PROJECT_ID,
    keys,
    now: () => NOW * 1000,
  });

describe("verifyFirebaseIdToken", () => {
  it("テスト用の鍵で署名したトークンで uid を返す", async () => {
    expect(await verify(await sign())).toEqual({ ok: true, uid: "uid-1" });
  });

  it("aud が違うと失敗する", async () => {
    expect(await verify(await sign({ aud: "other-project" }))).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("iss が違うと失敗する", async () => {
    expect(
      await verify(
        await sign({ iss: "https://securetoken.google.com/other-project" }),
      ),
    ).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("期限が過ぎていると失敗する", async () => {
    expect(await verify(await sign({ exp: NOW - 1 }))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("署名が違うと失敗する", async () => {
    expect(await verify(await sign({}, untrusted.privateKey))).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("認証の時刻が未来なら失敗する", async () => {
    expect(await verify(await sign({ auth_time: NOW + 60 }))).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("sub が空なら失敗する", async () => {
    expect(await verify(await sign({ sub: "" }))).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("形の崩れたトークンは失敗する", async () => {
    expect(await verify("not-a-jwt")).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("公開鍵が取れないときは keys_unavailable", async () => {
    const result = await verifyFirebaseIdToken(await sign(), {
      projectId: PROJECT_ID,
      keys: {
        getKey: async () => {
          throw new Error("network");
        },
      },
      now: () => NOW * 1000,
    });
    expect(result).toEqual({ ok: false, reason: "keys_unavailable" });
  });
});
