/** ペアワイズの sub を作るための鍵を持つ環境（Workers の秘密の値 `PAIRWISE_KEY`）。 */
export type PairwiseEnv = { PAIRWISE_KEY: string };

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * 主体の ID と相手の識別子から、相手ごとに違う ID（ペアワイズの sub）を作る。
 * 鍵つきのハッシュ（HMAC-SHA-256）なので、鍵を知らない相手どうしでは突き合わせられない。
 */
export const pairwiseSub = async (
  principalId: string,
  sectorId: string,
  key: string,
): Promise<string> => {
  if (key === "") throw new Error("PAIRWISE_KEY が空です");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // 区切りに NUL を挟み、("ab","c") と ("a","bc") が同じ入力にならないようにする
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(`${sectorId}\u0000${principalId}`),
  );
  return toBase64Url(new Uint8Array(signature));
};

/** Workers の環境の `PAIRWISE_KEY` を使って、ペアワイズの sub を作る。 */
export const pairwiseSubFromEnv = (
  env: PairwiseEnv,
  principalId: string,
  sectorId: string,
): Promise<string> => pairwiseSub(principalId, sectorId, env.PAIRWISE_KEY);
