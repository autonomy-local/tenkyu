import { describe, expect, it } from "vitest";
import { FakePrincipalLedger } from "./fakes/principals";

describe("FakePrincipalLedger", () => {
  it("作成した主体を照会できる", async () => {
    const ledger = new FakePrincipalLedger(() => 1_700_000_000);
    const created = await ledger.createPrincipal();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe("active");
    expect(created.value.created_at).toBe(1_700_000_000);

    const found = await ledger.getPrincipal(created.value.principal_id);
    expect(found).toEqual({
      ok: true,
      value: { principal_id: created.value.principal_id, status: "active" },
    });
  });

  it("ない主体の照会は principal_not_found になる", async () => {
    const ledger = new FakePrincipalLedger();
    expect(await ledger.getPrincipal("missing")).toEqual({
      ok: false,
      error: { error_code: "principal_not_found" },
    });
  });

  it("セッションの制限は上限と秒数の数字だけを返す", async () => {
    const ledger = new FakePrincipalLedger();
    const created = await ledger.createPrincipal();
    if (!created.ok) throw new Error("作成に失敗");
    const id = created.value.principal_id;
    ledger.policies.set(`${id}:bunko`, {
      max_concurrent_sessions: 3,
      idle_timeout_seconds: 86400,
    });

    const policy = await ledger.getSessionPolicy(id, "bunko");
    expect(policy).toEqual({
      ok: true,
      value: { max_concurrent_sessions: 3, idle_timeout_seconds: 86400 },
    });
    if (policy.ok) {
      expect(Object.keys(policy.value).sort()).toEqual([
        "idle_timeout_seconds",
        "max_concurrent_sessions",
      ]);
    }
  });
});
