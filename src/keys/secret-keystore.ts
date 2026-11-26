import type { KeyStore, PublicJwk } from "./keystore";

/** 秘密の値（`SIGNING_KEY_JWK`）に入れる、秘密鍵の JWK */
type PrivateJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d: string;
  kid: string;
};

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;

/** 前の版に入れる公開鍵の部分（秘密鍵の JWK を入れてもよい。d は使わない） */
type PublicPart = Omit<PrivateJwk, "d">;

const readJwk = (json: string, name: string): Partial<PrivateJwk> => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    // 秘密の値の中身をエラーに含めない
    throw new Error(`${name} を JSON として読めません`);
  }
  return (value ?? {}) as Partial<PrivateJwk>;
};

const isPublicPart = (jwk: Partial<PrivateJwk>): jwk is PublicPart =>
  jwk.kty === "EC" &&
  jwk.crv === "P-256" &&
  typeof jwk.x === "string" &&
  typeof jwk.y === "string" &&
  typeof jwk.kid === "string" &&
  jwk.kid !== "";

const parsePrivateJwk = (json: string): PrivateJwk => {
  const jwk = readJwk(json, "SIGNING_KEY_JWK");
  if (
    !isPublicPart(jwk) ||
    typeof (jwk as Partial<PrivateJwk>).d !== "string"
  ) {
    throw new Error(
      "SIGNING_KEY_JWK は kid 付きの P-256 の秘密鍵の JWK にしてください",
    );
  }
  return jwk as PrivateJwk;
};

const parsePreviousJwk = (json: string): PublicPart => {
  const jwk = readJwk(json, "SIGNING_KEY_JWK_PREVIOUS");
  if (!isPublicPart(jwk)) {
    throw new Error(
      "SIGNING_KEY_JWK_PREVIOUS は kid 付きの P-256 の JWK にしてください",
    );
  }
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid: jwk.kid };
};

const toPublicJwk = (jwk: PublicPart): PublicJwk => ({
  kty: "EC",
  crv: "P-256",
  x: jwk.x,
  y: jwk.y,
  kid: jwk.kid,
  alg: "ES256",
  use: "sig",
});

/**
 * Workers の秘密の値に置いた秘密鍵（JWK）を使う KeyStore の中身。
 * 鍵の入れ替えの間は、前の版（`SIGNING_KEY_JWK_PREVIOUS`）も持ち、検証だけに使う。
 * 署名はいつも今の版（`SIGNING_KEY_JWK`）で行う。
 */
export class SecretKeyStore implements KeyStore {
  readonly algorithm = "ES256" as const;
  private readonly jwk: PrivateJwk;
  private readonly previous?: PublicPart;
  private signingKey?: Promise<CryptoKey>;
  private readonly verifyKeys = new Map<string, Promise<CryptoKey>>();

  constructor(privateJwkJson: string, previousJwkJson?: string) {
    this.jwk = parsePrivateJwk(privateJwkJson);
    if (previousJwkJson !== undefined && previousJwkJson !== "") {
      const previous = parsePreviousJwk(previousJwkJson);
      if (previous.kid === this.jwk.kid) {
        throw new Error(
          "SIGNING_KEY_JWK と SIGNING_KEY_JWK_PREVIOUS の kid が同じです",
        );
      }
      this.previous = previous;
    }
  }

  static fromEnv(env: {
    SIGNING_KEY_JWK: string;
    SIGNING_KEY_JWK_PREVIOUS?: string;
  }): SecretKeyStore {
    return new SecretKeyStore(
      env.SIGNING_KEY_JWK,
      env.SIGNING_KEY_JWK_PREVIOUS,
    );
  }

  async keyVersion(): Promise<string> {
    return this.jwk.kid;
  }

  async sign(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    this.signingKey ??= crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: this.jwk.x, y: this.jwk.y, d: this.jwk.d },
      ALGORITHM,
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      await this.signingKey,
      data,
    );
    return new Uint8Array(signature);
  }

  async publicKey(): Promise<PublicJwk> {
    return toPublicJwk(this.jwk);
  }

  async publicKeys(): Promise<PublicJwk[]> {
    return [this.jwk, ...(this.previous ? [this.previous] : [])].map(
      toPublicJwk,
    );
  }

  async verify(
    data: Uint8Array<ArrayBuffer>,
    signature: Uint8Array<ArrayBuffer>,
    kid: string,
  ): Promise<boolean> {
    const jwk = [this.jwk, this.previous].find((k) => k?.kid === kid);
    if (!jwk) return false;
    let key = this.verifyKeys.get(kid);
    if (!key) {
      key = crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
        ALGORITHM,
        false,
        ["verify"],
      );
      this.verifyKeys.set(kid, key);
    }
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      await key,
      signature,
      data,
    );
  }
}
