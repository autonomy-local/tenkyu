/** 確認コードの桁数。 */
export const CODE_DIGITS = 6;

const CODE_SPACE = 10 ** CODE_DIGITS;
// 2^32 を超えない、CODE_SPACE の倍数の最大値。これ以上の乱数は捨てて、偏りをなくす。
const UNBIASED_LIMIT = Math.floor(2 ** 32 / CODE_SPACE) * CODE_SPACE;

/** Web Crypto の乱数で、偏りのない6桁のコード（先頭の0を含む文字列）を作る。 */
export const generateCode = (): string => {
  const buffer = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value < UNBIASED_LIMIT) {
      return (value % CODE_SPACE).toString().padStart(CODE_DIGITS, "0");
    }
  }
};

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * コードを鍵つきのハッシュ（HMAC-SHA-256、16進）にする。
 * 6桁のコードは総当たりできるので、鍵のない SHA-256 にはしない（docs/events.md）。
 */
export const hashCode = async (code: string, key: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(code),
  );
  return toHex(new Uint8Array(signature));
};

/** 2つのハッシュを、時間の差の出ない比べ方で比べる。 */
export const timingSafeEqualHash = (a: string, b: string): boolean => {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  // 途中で抜けずに全バイトの差を重ねる。一致しない位置で時間が変わらない
  let diff = 0;
  for (let i = 0; i < left.byteLength; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};

/** 入力されたコードが、保存してあるハッシュと一致するかを確かめる。 */
export const verifyCode = async (
  input: string,
  storedHash: string,
  key: string,
): Promise<boolean> =>
  timingSafeEqualHash(await hashCode(input, key), storedHash);
