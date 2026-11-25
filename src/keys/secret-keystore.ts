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

const parsePrivateJwk = (json: string): PrivateJwk => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    // 秘密の値の中身をエラーに含めない
    throw new Error("SIGNING_KEY_JWK を JSON として読めません");
  }
  const jwk = value as Partial<PrivateJwk>;
  if (
    jwk.kty !== "EC" ||
    jwk.crv !== "P-256" ||
    typeof jwk.x !== "string" ||
    typeof jwk.y !== "string" ||
    typeof jwk.d !== "string" ||
    typeof jwk.kid !== "string" ||
    jwk.kid === ""
  ) {
    throw new Error(
      "SIGNING_KEY_JWK は kid 付きの P-256 の秘密鍵の JWK にしてください",
    );
  }
  return jwk as PrivateJwk;
};

/** Workers の秘密の値に置いた秘密鍵（JWK）を使う KeyStore の中身 */
export class SecretKeyStore implements KeyStore {
  readonly algorithm = "ES256" as const;
  private readonly jwk: PrivateJwk;
  private signingKey?: Promise<CryptoKey>;

  constructor(privateJwkJson: string) {
    this.jwk = parsePrivateJwk(privateJwkJson);
  }

  static fromEnv(env: { SIGNING_KEY_JWK: string }): SecretKeyStore {
    return new SecretKeyStore(env.SIGNING_KEY_JWK);
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
    return {
      kty: "EC",
      crv: "P-256",
      x: this.jwk.x,
      y: this.jwk.y,
      kid: this.jwk.kid,
      alg: "ES256",
      use: "sig",
    };
  }
}
