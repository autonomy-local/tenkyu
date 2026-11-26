import {
  createLocalJWKSet,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";

/** Firebase の ID トークンの署名を確かめる、Google の公開鍵（JWK Set）の URL。 */
export const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/** 応答に Cache-Control の max-age がないときに覚えておく秒数。 */
export const DEFAULT_MAX_AGE_SECONDS = 0;

type Fetch = (input: string) => Promise<Response>;

export type FirebaseKeysOptions = {
  /** テストで差し替える fetch */
  fetch?: Fetch;
  /** 今の時刻（ミリ秒）。テストで差し替える */
  now?: () => number;
  url?: string;
};

/** Cache-Control から max-age（秒）を読む。なければ null。 */
export const parseMaxAge = (cacheControl: string | null): number | null => {
  if (!cacheControl) return null;
  const match = /(?:^|,)\s*max-age\s*=\s*(\d+)\s*(?:,|$)/i.exec(cacheControl);
  return match ? Number(match[1]) : null;
};

/**
 * Google の公開鍵を取得し、応答の Cache-Control の max-age の間だけ覚えておく。
 * 期間内は取りに行かず、期間を過ぎたら取り直す。
 */
export class FirebaseKeys {
  private readonly fetch: Fetch;
  private readonly now: () => number;
  private readonly url: string;
  private cached?: {
    jwks: JSONWebKeySet;
    getKey: JWTVerifyGetKey;
    expiresAt: number;
  };
  private inflight?: Promise<JSONWebKeySet>;

  constructor(options: FirebaseKeysOptions = {}) {
    this.fetch = options.fetch ?? ((input) => fetch(input));
    this.now = options.now ?? Date.now;
    this.url = options.url ?? FIREBASE_JWKS_URL;
  }

  /** 公開鍵の一覧（JWK Set）。期間内なら覚えているものを返す。 */
  async jwks(): Promise<JSONWebKeySet> {
    if (this.cached && this.now() < this.cached.expiresAt) {
      return this.cached.jwks;
    }
    // 同時に来た要求で何度も取りに行かない
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  /** jose の jwtVerify にそのまま渡せる鍵の引き当て。 */
  async getKey(): Promise<JWTVerifyGetKey> {
    await this.jwks();
    if (!this.cached) throw new Error("Firebase の公開鍵を取得できません");
    return this.cached.getKey;
  }

  private async refresh(): Promise<JSONWebKeySet> {
    const response = await this.fetch(this.url);
    if (!response.ok) {
      throw new Error(
        `Firebase の公開鍵の取得に失敗しました（${response.status}）`,
      );
    }
    const jwks = (await response.json()) as JSONWebKeySet;
    if (!Array.isArray(jwks?.keys)) {
      throw new Error("Firebase の公開鍵の形が想定と違います");
    }
    const maxAge =
      parseMaxAge(response.headers.get("Cache-Control")) ??
      DEFAULT_MAX_AGE_SECONDS;
    this.cached = {
      jwks,
      getKey: createLocalJWKSet(jwks),
      expiresAt: this.now() + maxAge * 1000,
    };
    return jwks;
  }
}
