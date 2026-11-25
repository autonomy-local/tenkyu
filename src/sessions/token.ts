/** セッションの ID のバイト数。32バイト（256ビット）。 */
export const SESSION_ID_BYTES = 32;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Web Crypto の乱数で、推測できないセッションの ID（base64url）を作る。 */
export const generateSessionId = (): string => {
  const bytes = new Uint8Array(SESSION_ID_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

/** D1 に置くための、セッションの ID の SHA-256 のハッシュ（16進）。 */
export const hashSessionId = async (sessionId: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionId),
  );
  return toHex(new Uint8Array(digest));
};
