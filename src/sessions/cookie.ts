/**
 * セッションのクッキーの名前。`__Host-` で始めて、Domain を付けず、
 * 呼んだサービスのホストだけに届くようにする。
 */
export const SESSION_COOKIE_NAME = "__Host-tenkyu_session";

const ATTRIBUTES = ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"] as const;

/** セッションのクッキーを組み立てる（Set-Cookie の値）。 */
export const buildSessionCookie = (
  sessionId: string,
  options: { maxAgeSeconds?: number } = {},
): string => {
  const parts = [`${SESSION_COOKIE_NAME}=${sessionId}`, ...ATTRIBUTES];
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  return parts.join("; ");
};

/** セッションのクッキーを消すための Set-Cookie の値（期限を過去にする）。 */
export const buildClearSessionCookie = (): string =>
  [
    `${SESSION_COOKIE_NAME}=`,
    ...ATTRIBUTES,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");

/** 要求の Cookie のヘッダーから、セッションの ID を読む。なければ null。 */
export const readSessionCookie = (request: Request): string | null => {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(index + 1).trim();
    return value === "" ? null : value;
  }
  return null;
};
