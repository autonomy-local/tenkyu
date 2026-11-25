/**
 * 検証の口の約束（docs/contract.md）の型。Tenkyu と呼ぶ側のサービスが同じ型を使う。
 * 項目の追加は任意の項目として足す。削除・意味の変更は CONTRACT_VERSION を上げる（docs/contract.md の4）。
 */

/** 応答の形式の版（docs/contract.md の4）。 */
export const CONTRACT_VERSION = 1;
export type ContractVersion = typeof CONTRACT_VERSION;

/**
 * 呼ぶ側が検証の結果を覚えておいてよい秒数（docs/contract.md の3）。
 * 文書では案（60秒）。最終の秒数は PR のレビューで決める。
 */
export const VERIFY_RESULT_CACHE_TTL_SECONDS = 60;

/** 認証の手段（`amr`）。 */
export type AuthMethod = "email_code" | "passkey" | "firebase";

/** 検証の失敗の種類（docs/contract.md の2）。 */
export const VERIFY_FAILURE_REASONS = [
  "expired",
  "revoked",
  "limit_exceeded",
  "idle_timeout",
  "unknown",
] as const;
export type VerifyFailureReason = (typeof VERIFY_FAILURE_REASONS)[number];

// ── 1.1 セッションの検証 ───────────────────────────────

export type VerifySessionRequest = {
  /** クライアントから提示されたセッショントークン（平文） */
  token: string;
  /** 問い合わせ元のサービスの識別子（例：`engawa`、`bunko`） */
  service: string;
};

/** 検証に成功したときの返り値。連絡先（メールアドレスなど）の項目は持たない。 */
export type VerifySessionSuccess = {
  valid: true;
  /** 主体の ID（Mizucho の `principals.id`） */
  sub: string;
  service: string;
  amr: AuthMethod;
  /** 認証が成功した時刻（UNIX エポック秒） */
  auth_time: number;
  /** セッションの絶対の有効期限（UNIX エポック秒） */
  expires_at: number;
  version: ContractVersion;
};

export type VerifySessionFailure = {
  valid: false;
  reason: VerifyFailureReason;
  version: ContractVersion;
};

export type VerifySessionResponse = VerifySessionSuccess | VerifySessionFailure;

// ── 1.2 ログアウト ─────────────────────────────────────

export type LogoutRequest = {
  /** 失効させるセッショントークン（平文） */
  token: string;
  service: string;
};

export type LogoutResponse = {
  revoked: boolean;
  version: ContractVersion;
};

// ── 1.3 /auth/* の転送 ─────────────────────────────────

/** `/auth/*` を転送するときに、要求元のサービスを伝えるヘッダー。 */
export const SERVICE_HEADER = "X-Tenkyu-Service";

export type AuthForwardRequest = {
  /** クライアントからサービスの Worker に届いた元の HTTP の要求 */
  request: Request;
  service: string;
};

export type AuthForwardResponse = {
  /** Tenkyu が作った HTTP の応答（HTML、リダイレクト、Set-Cookie、JSON） */
  response: Response;
};
