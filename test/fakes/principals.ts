import type {
  CreatedPrincipal,
  LedgerResult,
  PrincipalLedger,
  PrincipalRecord,
  SessionPolicy,
} from "../../src/principals/types";

const DEFAULT_POLICY: SessionPolicy = {
  max_concurrent_sessions: 1,
  idle_timeout_seconds: 1800,
};

/** テスト用の台帳。主体を配列で持つだけ。 */
export class FakePrincipalLedger implements PrincipalLedger {
  readonly principals: PrincipalRecord[] = [];
  /** `${principalId}:${service}` ごとの制限。なければ既定の値 */
  readonly policies = new Map<string, SessionPolicy>();

  constructor(
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  async createPrincipal(): Promise<LedgerResult<CreatedPrincipal>> {
    const created: CreatedPrincipal = {
      principal_id: crypto.randomUUID(),
      status: "active",
      created_at: this.now(),
    };
    this.principals.push({
      principal_id: created.principal_id,
      status: "active",
    });
    return { ok: true, value: created };
  }

  async getPrincipal(
    principalId: string,
  ): Promise<LedgerResult<PrincipalRecord>> {
    const found = this.principals.find((p) => p.principal_id === principalId);
    if (!found)
      return { ok: false, error: { error_code: "principal_not_found" } };
    return { ok: true, value: { ...found } };
  }

  async getSessionPolicy(
    principalId: string,
    service: string,
  ): Promise<LedgerResult<SessionPolicy>> {
    if (!this.principals.some((p) => p.principal_id === principalId)) {
      return { ok: false, error: { error_code: "principal_not_found" } };
    }
    const policy =
      this.policies.get(`${principalId}:${service}`) ?? DEFAULT_POLICY;
    return { ok: true, value: { ...policy } };
  }
}
