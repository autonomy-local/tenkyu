/**
 * 主体の台帳の差し込み口（docs/ledger-contract.md）。本番の中身は Mizucho。
 * 役割の名前は持ち込まず、台帳が判定した数字（上限と秒数）だけを受ける。
 */

export type PrincipalStatus = "active" | "suspended";

/** 1. 主体の作成の返り値 */
export type CreatedPrincipal = {
  principal_id: string;
  status: "active";
  /** 作成した時刻（UNIX エポック秒） */
  created_at: number;
};

/** 2. 主体の照会の返り値 */
export type PrincipalRecord = {
  principal_id: string;
  /** `active` 以外は認証できないものとして扱う */
  status: PrincipalStatus;
};

/** 3. サービスごとのセッションの制限。数字だけ */
export type SessionPolicy = {
  /** 同時に持てるセッションの上限（0 はログイン不可） */
  max_concurrent_sessions: number;
  /** 無操作で失効するまでの秒数 */
  idle_timeout_seconds: number;
};

export type LedgerErrorCode =
  | "principal_not_found"
  | "invalid_principal_id"
  | "service_not_allowed"
  | "rate_limit_exceeded"
  | "internal_error";

export type LedgerError = { error_code: LedgerErrorCode; message?: string };

export type LedgerResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LedgerError };

export interface PrincipalLedger {
  /** 新しい主体の ID を発行する。個人の情報は渡さない */
  createPrincipal(): Promise<LedgerResult<CreatedPrincipal>>;
  /** 主体があり、有効かを照会する */
  getPrincipal(principalId: string): Promise<LedgerResult<PrincipalRecord>>;
  /** 主体がそのサービスで持てるセッションの上限と、無操作の時間を取る */
  getSessionPolicy(
    principalId: string,
    service: string,
  ): Promise<LedgerResult<SessionPolicy>>;
}
