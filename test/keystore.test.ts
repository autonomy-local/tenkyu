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
