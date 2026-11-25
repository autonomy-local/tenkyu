const FALLBACK = "/";
const BASE = "https://return-to.invalid";

/**
 * ログイン後の戻り先を検証する。呼んだサービスの中の道（`/` で始まる相対の道）
 * なら正規化して返し、それ以外（外のサイト、`//host`、`/\host`、`javascript:` など）は `/` を返す。
 */
export const sanitizeReturnTo = (value: string | null | undefined): string => {
  if (typeof value !== "string" || value === "") return FALLBACK;
  // 先頭は `/` だけ。`//` と `/\` はブラウザが別のホストとして読むので拒む
  if (!value.startsWith("/") || value[1] === "/" || value[1] === "\\") {
    return FALLBACK;
  }
  // 制御文字（タブや改行はブラウザが取り除いて `//` になりうる）とバックスラッシュを拒む
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || char === "\\") return FALLBACK;
  }
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== BASE) return FALLBACK;
  return `${url.pathname}${url.search}${url.hash}`;
};
