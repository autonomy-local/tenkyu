import { errors, type JWTVerifyGetKey, jwtVerify } from "jose";

/** Firebase の ID トークンの検証の結果。成功なら uid を返す。 */
export type FirebaseVerifyResult =
  | { ok: true; uid: string }
  | {
      ok: false;
      /** 失敗の種類。トークンの中身や理由の詳細は返さない */
      reason: "invalid_token" | "expired" | "keys_unavailable";
    };

export type FirebaseVerifyOptions = {
  /** Firebase のプロジェクト ID。`aud` と `iss` の照合に使う */
  projectId: string;
  /** 公開鍵の引き当て（FirebaseKeys など） */
  keys: { getKey(): Promise<JWTVerifyGetKey> };
  /** 今の時刻（ミリ秒）。テストで差し替える */
  now?: () => number;
};

/**
 * Firebase の ID トークンを検証し、uid（`sub`）を返す。
 * 署名（RS256、Google の公開鍵）、`aud`（プロジェクト ID）、`iss`、期限を確かめる。
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens の「サードパーティの JWT ライブラリ」の条件に合わせる。
 */
export const verifyFirebaseIdToken = async (
  token: string,
  options: FirebaseVerifyOptions,
): Promise<FirebaseVerifyResult> => {
  let getKey: JWTVerifyGetKey;
  try {
    getKey = await options.keys.getKey();
  } catch {
    return { ok: false, reason: "keys_unavailable" };
  }
  const now = new Date((options.now ?? Date.now)());
  try {
    const { payload } = await jwtVerify(token, getKey, {
      algorithms: ["RS256"],
      audience: options.projectId,
      issuer: `https://securetoken.google.com/${options.projectId}`,
      currentDate: now,
      requiredClaims: ["exp", "iat", "sub", "auth_time"],
    });
    const nowSeconds = Math.floor(now.getTime() / 1000);
    // 発行の時刻と認証の時刻は過去でなければならない。sub（uid）は空でない
    if (
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      (payload.iat ?? Number.POSITIVE_INFINITY) > nowSeconds ||
      typeof payload.auth_time !== "number" ||
      payload.auth_time > nowSeconds
    ) {
      return { ok: false, reason: "invalid_token" };
    }
    return { ok: true, uid: payload.sub };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid_token" };
  }
};
