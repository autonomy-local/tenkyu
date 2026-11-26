import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

/** CSRF のトークンを入れるクッキーの名前（二重送信のクッキー）。 */
export const CSRF_COOKIE_NAME = "__Host-tenkyu_csrf";
/** フォームの隠し項目の名前。 */
export const CSRF_FIELD_NAME = "csrf_token";

const TOKEN_BYTES = 32;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/** Web Crypto の乱数で、CSRF のトークンを作る。 */
export const generateCsrfToken = (): string => {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

/**
 * トークンを作ってクッキーに入れ、フォームの隠し項目に入れる値を返す。
 * 画面を返す GET の処理で呼ぶ。
 */
export const issueCsrfToken = (c: Context): string => {
  const token = generateCsrfToken();
  setCookie(c, CSRF_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  return token;
};

/** 時間の差の出ない比べ方で、2つの文字列が同じかを返す。 */
const timingSafeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < left.byteLength; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};

/**
 * POST などで、クッキーのトークンとフォームの隠し項目のトークンが一致するかを確かめる。
 * ない・違うときは 403 を返す。
 */
export const csrfProtection = (): MiddlewareHandler => async (c, next) => {
  if (!UNSAFE_METHODS.has(c.req.method)) return next();

  const cookieToken = getCookie(c, CSRF_COOKIE_NAME);
  let formToken: unknown;
  try {
    formToken = (await c.req.parseBody())[CSRF_FIELD_NAME];
  } catch {
    formToken = undefined;
  }

  if (
    typeof cookieToken !== "string" ||
    cookieToken === "" ||
    typeof formToken !== "string" ||
    !timingSafeEqual(cookieToken, formToken)
  ) {
    return c.text("Forbidden", 403);
  }
  return next();
};
