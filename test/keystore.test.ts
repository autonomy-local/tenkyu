import { beforeAll, describe, expect, it } from "vitest";
import type { KeyStore } from "../src/keys/keystore";
import { SecretKeyStore } from "../src/keys/secret-keystore";

let privateJwkJson: string;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey,
  )) as JsonWebKey;
  privateJwkJson = JSON.stringify({ ...jwk, kid: "2026-11-v1" });
});

const verifyWith = async (
  store: KeyStore,
  data: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>,
) => {
  const { kty, crv, x, y } = await store.publicKey();
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty, crv, x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signature,
    data,
  );
};

describe("SecretKeyStore", () => {
  it("署名を公開鍵で検証できる", async () => {
    const store: KeyStore = SecretKeyStore.fromEnv({
      SIGNING_KEY_JWK: privateJwkJson,
    });
    const data = new TextEncoder().encode("header.payload");
    const signature = await store.sign(data);
    expect(signature.byteLength).toBe(64);
    expect(await verifyWith(store, data, signature)).toBe(true);
  });

  it("別のデータでは検証が通らない", async () => {
    const store = new SecretKeyStore(privateJwkJson);
    const signature = await store.sign(new TextEncoder().encode("a"));
    expect(
      await verifyWith(store, new TextEncoder().encode("b"), signature),
    ).toBe(false);
  });

  it("公開鍵に秘密の部分（d）を含めず、kid が鍵の版になる", async () => {
    const store = new SecretKeyStore(privateJwkJson);
    const publicKey = await store.publicKey();
    expect(publicKey).not.toHaveProperty("d");
    expect(publicKey.kid).toBe("2026-11-v1");
    expect(await store.keyVersion()).toBe("2026-11-v1");
    expect(publicKey.alg).toBe("ES256");
  });

  it("読めない秘密の値は、中身をエラーに含めずに失敗する", () => {
    expect(() => new SecretKeyStore("not-json-secret")).toThrow(
      /^(?!.*not-json-secret)/,
    );
    expect(
      () => new SecretKeyStore(JSON.stringify({ kty: "EC", crv: "P-256" })),
    ).toThrow();
  });
});

const generatePrivateJwk = async (kid: string) => {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey,
  )) as JsonWebKey;
  return JSON.stringify({ ...jwk, kid });
};

describe("SecretKeyStore（鍵の版の併存）", () => {
  const data = new TextEncoder().encode("header.payload");

  it("新旧2つの版の鍵で署名したものが、どちらも検証できる", async () => {
    const oldJwk = await generatePrivateJwk("v1");
    const newJwk = await generatePrivateJwk("v2");
    const oldStore = new SecretKeyStore(oldJwk);
    const oldSignature = await oldStore.sign(data);

    // 入れ替え後：今の版は v2、前の版は v1
    const store = SecretKeyStore.fromEnv({
      SIGNING_KEY_JWK: newJwk,
      SIGNING_KEY_JWK_PREVIOUS: oldJwk,
    });
    const newSignature = await store.sign(data);

    expect(await store.keyVersion()).toBe("v2");
    expect(await store.verify(data, newSignature, "v2")).toBe(true);
    expect(await store.verify(data, oldSignature, "v1")).toBe(true);
    expect((await store.publicKeys()).map((k) => k.kid)).toEqual(["v2", "v1"]);
  });

  it("知らない版の署名は失敗する", async () => {
    const store = new SecretKeyStore(await generatePrivateJwk("v2"));
    const signature = await store.sign(data);
    expect(await store.verify(data, signature, "v9")).toBe(false);
  });

  it("版を取り違えた署名は失敗する", async () => {
    const oldJwk = await generatePrivateJwk("v1");
    const store = new SecretKeyStore(await generatePrivateJwk("v2"), oldJwk);
    const signature = await store.sign(data);
    expect(await store.verify(data, signature, "v1")).toBe(false);
  });

  it("前の版の公開鍵に秘密の部分（d）を含めない", async () => {
    const store = new SecretKeyStore(
      await generatePrivateJwk("v2"),
      await generatePrivateJwk("v1"),
    );
    for (const key of await store.publicKeys()) {
      expect(key).not.toHaveProperty("d");
    }
  });

  it("2つの版の kid が同じなら失敗する", async () => {
    const jwk = await generatePrivateJwk("v1");
    expect(() => new SecretKeyStore(jwk, jwk)).toThrow(/kid/);
  });

  it("前の版がないときは今の版だけを持つ", async () => {
    const store = SecretKeyStore.fromEnv({
      SIGNING_KEY_JWK: await generatePrivateJwk("v1"),
    });
    expect((await store.publicKeys()).map((k) => k.kid)).toEqual(["v1"]);
  });
});
