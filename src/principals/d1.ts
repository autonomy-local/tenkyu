import type {
  CreatedPrincipal,
  LedgerResult,
  PrincipalLedger,
  PrincipalRecord,
  PrincipalStatus,
  SessionPolicy,
} from "./types";

/**
 * 主体とサービスに制限の行がないときに返す値。
 * 同時のセッションは1つ、無操作で30分（docs/ledger-contract.md の例と同じ）。
 */
export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  max_concurrent_sessions: 1,
  idle_timeout_seconds: 1800,
};

export type D1PrincipalLedgerOptions = {
  /** 今の時刻（UNIX エポック秒）。テストで差し替える */
  now?: () => number;
  /** 主体の ID の作り方。テストで差し替える */
  newId?: () => string;
  /** 制限の行がないときに返す値 */
  defaultPolicy?: SessionPolicy;
};

const internalError = (): LedgerResult<never> => ({
  ok: false,
  error: { error_code: "internal_error" },
});

const notFound = (): LedgerResult<never> => ({
  ok: false,
  error: { error_code: "principal_not_found" },
});

/**
 * 主体の台帳の差し込み口（docs/ledger-contract.md）の、D1 に置く簡単な中身。
 * Mizucho なしで動かすためのもので、表は local_principals と local_session_policies。
 * D1 の誤りは internal_error にして返し、呼ぶ側で安全側に倒せるようにする。
 */
export class D1PrincipalLedger implements PrincipalLedger {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly defaultPolicy: SessionPolicy;

  constructor(
    private readonly db: D1Database,
    options: D1PrincipalLedgerOptions = {},
  ) {
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.defaultPolicy = options.defaultPolicy ?? DEFAULT_SESSION_POLICY;
  }

  async createPrincipal(): Promise<LedgerResult<CreatedPrincipal>> {
    const created: CreatedPrincipal = {
      principal_id: this.newId(),
      status: "active",
      created_at: this.now(),
    };
    try {
      await this.db
        .prepare(
          "INSERT INTO local_principals (id, status, created_at) VALUES (?, 'active', ?)",
        )
        .bind(created.principal_id, created.created_at)
        .run();
    } catch {
      return internalError();
    }
    return { ok: true, value: created };
  }

  async getPrincipal(
    principalId: string,
  ): Promise<LedgerResult<PrincipalRecord>> {
    if (!principalId) {
      return { ok: false, error: { error_code: "invalid_principal_id" } };
    }
    let row: { id: string; status: PrincipalStatus } | null;
    try {
      row = await this.db
        .prepare("SELECT id, status FROM local_principals WHERE id = ?")
        .bind(principalId)
        .first();
    } catch {
      return internalError();
    }
    if (!row) return notFound();
    return { ok: true, value: { principal_id: row.id, status: row.status } };
  }

  async getSessionPolicy(
    principalId: string,
    service: string,
  ): Promise<LedgerResult<SessionPolicy>> {
    if (!principalId) {
      return { ok: false, error: { error_code: "invalid_principal_id" } };
    }
    let rows: {
      found: number;
      max_concurrent_sessions: number | null;
      idle_timeout_seconds: number | null;
    } | null;
    try {
      rows = await this.db
        .prepare(
          `SELECT 1 AS found, s.max_concurrent_sessions, s.idle_timeout_seconds
           FROM local_principals p
           LEFT JOIN local_session_policies s ON s.principal_id = p.id AND s.service = ?
           WHERE p.id = ?`,
        )
        .bind(service, principalId)
        .first();
    } catch {
      return internalError();
    }
    if (!rows) return notFound();
    if (
      rows.max_concurrent_sessions === null ||
      rows.idle_timeout_seconds === null
    ) {
      return { ok: true, value: { ...this.defaultPolicy } };
    }
    return {
      ok: true,
      value: {
        max_concurrent_sessions: rows.max_concurrent_sessions,
        idle_timeout_seconds: rows.idle_timeout_seconds,
      },
    };
  }
}
