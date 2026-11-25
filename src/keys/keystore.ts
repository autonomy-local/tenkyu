/**
 * 署名の鍵の差し込み口（KeyStore）。中身を Workers の秘密の値から HSM などに替えられるように、
 * 鍵の置き場所に固有の項目は持たない。
 */

/** 署名の方式。今は ES256（P-256、SHA-256）だけ */
export type SigningAlgorithm = "ES256";

/** 公開鍵（JWK）。秘密の部分（`d`）は持たない */
export type PublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  kid: string;
  alg: SigningAlgorithm;
  use: "sig";
};

export interface KeyStore {
  /** 署名の方式 */
  readonly algorithm: SigningAlgorithm;
  /** 今使っている鍵の版（JWS の `kid`） */
  keyVersion(): Promise<string>;
  /** データに署名する。署名は JWS の形（r‖s の64バイト） */
  sign(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>;
  /** 検証に使う公開鍵 */
  publicKey(): Promise<PublicJwk>;
}
