import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

/** Cloudflare Access が検証済みの要求に付ける JWT のヘッダー。 */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/** 検証できた運営者。後の処理は c.get("accessIdentity") で受ける。 */
export type AccessIdentity = {
  sub: string;
  /** Access のトークンに含まれるメールアドレス。サービス トークンの要求にはない */
  email?: string;
};

export type AccessVariables = { accessIdentity: AccessIdentity };

export type AccessOptions = {
  /** Access のチームのドメイン（例: `https://example.cloudflareaccess.com`）。`iss` の照合と公開鍵の取得に使う */
  teamDomain: string;
  /** Access のアプリの AUD タグ。`aud` の照合に使う */
  aud: string;
  /** 公開鍵の引き当て。省くとチームのドメインの `/cdn-cgi/access/certs` から取る。テストで差し替える */
  getKey?: JWTVerifyGetKey;
  /** 今の時刻（ミリ秒）。テストで差し替える */
  now?: () => number;
};

/**
 * Cloudflare Access の JWT を Worker の側でも検証するミドルウェア。
 * JWT がなければ 401、署名・`aud`・`iss`・期限のどれかが違えば 403 にする。
 * 理由の詳細は応答に書かない。
 */
export const accessAuth = (
  options: AccessOptions,
): MiddlewareHandler<{ Variables: AccessVariables }> => {
  const issuer = options.teamDomain.replace(/\/+$/, "");
  const getKey =
    options.getKey ??
    createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async (c, next) => {
    const token = c.req.header(ACCESS_JWT_HEADER);
    if (!token) return c.text("Unauthorized", 401);
    try {
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ["RS256"],
        audience: options.aud,
        issuer,
        currentDate: options.now ? new Date(options.now()) : undefined,
        requiredClaims: ["exp", "sub"],
      });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        return c.text("Forbidden", 403);
      }
      const email =
        typeof payload.email === "string" ? payload.email : undefined;
      c.set("accessIdentity", { sub: payload.sub, email });
    } catch {
      return c.text("Forbidden", 403);
    }
    await next();
  };
};
