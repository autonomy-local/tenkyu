import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  D1PrincipalLedger,
  DEFAULT_SESSION_POLICY,
} from "../src/principals/d1";

const setPolicy = (
  principalId: string,
  service: string,
  max: number,
  idle: number,
) =>
  env.DB.prepare(
    "INSERT INTO local_session_policies (principal_id, service, max_concurrent_sessions, idle_timeout_seconds) VALUES (?, ?, ?, ?)",
  )
    .bind(principalId, service, max, idle)
    .run();

describe("D1PrincipalLedger", () => {
  it("作成した主体を照会できる", async () => {
    const ledger = new D1PrincipalLedger(env.DB, {
      now: () => 1_700_000_000,
      newId: () => "principal-1",
    });
    expect(await ledger.createPrincipal()).toEqual({
      ok: true,
      value: {
        principal_id: "principal-1",
        status: "active",
        created_at: 1_700_000_000,
      },
    });
    expect(await ledger.getPrincipal("principal-1")).toEqual({
      ok: true,
      value: { principal_id: "principal-1", status: "active" },
    });
  });

  it("作成するたびに別の ID になる", async () => {
    const ledger = new D1PrincipalLedger(env.DB);
    const a = await ledger.createPrincipal();
    const b = await ledger.createPrincipal();
    if (!a.ok || !b.ok) throw new Error("作成に失敗した");
    expect(a.value.principal_id).not.toBe(b.value.principal_id);
  });

  it("止めた主体は suspended で返る", async () => {
    const ledger = new D1PrincipalLedger(env.DB, { newId: () => "p-susp" });
    await ledger.createPrincipal();
    await env.DB.prepare(
      "UPDATE local_principals SET status = 'suspended' WHERE id = ?",
    )
      .bind("p-susp")
      .run();
    expect(await ledger.getPrincipal("p-susp")).toEqual({
      ok: true,
      value: { principal_id: "p-susp", status: "suspended" },
    });
  });

  it("ない主体は principal_not_found、空の ID は invalid_principal_id", async () => {
    const ledger = new D1PrincipalLedger(env.DB);
    expect(await ledger.getPrincipal("missing")).toEqual({
      ok: false,
      error: { error_code: "principal_not_found" },
    });
    expect(await ledger.getPrincipal("")).toEqual({
      ok: false,
      error: { error_code: "invalid_principal_id" },
    });
    expect(await ledger.getSessionPolicy("missing", "engawa")).toEqual({
      ok: false,
      error: { error_code: "principal_not_found" },
    });
  });

  it("上限と時間を設定した値で返す", async () => {
    const ledger = new D1PrincipalLedger(env.DB, { newId: () => "p-policy" });
    await ledger.createPrincipal();
    await setPolicy("p-policy", "engawa", 3, 86_400);
    expect(await ledger.getSessionPolicy("p-policy", "engawa")).toEqual({
      ok: true,
      value: { max_concurrent_sessions: 3, idle_timeout_seconds: 86_400 },
    });
  });

  it("上限と時間が未設定のサービスでは既定の値を返す", async () => {
    const ledger = new D1PrincipalLedger(env.DB, { newId: () => "p-default" });
    await ledger.createPrincipal();
    await setPolicy("p-default", "engawa", 3, 86_400);
    expect(await ledger.getSessionPolicy("p-default", "bunko")).toEqual({
      ok: true,
      value: DEFAULT_SESSION_POLICY,
    });
    expect(DEFAULT_SESSION_POLICY).toEqual({
      max_concurrent_sessions: 1,
      idle_timeout_seconds: 1800,
    });
  });

  it("既定の値は差し替えられる", async () => {
    const ledger = new D1PrincipalLedger(env.DB, {
      newId: () => "p-custom",
      defaultPolicy: { max_concurrent_sessions: 2, idle_timeout_seconds: 600 },
    });
    await ledger.createPrincipal();
    expect(await ledger.getSessionPolicy("p-custom", "engawa")).toEqual({
      ok: true,
      value: { max_concurrent_sessions: 2, idle_timeout_seconds: 600 },
    });
  });

  it("D1 の誤りは internal_error で返す", async () => {
    const ledger = new D1PrincipalLedger(env.DB, { newId: () => "p-dup" });
    await ledger.createPrincipal();
    // 同じ ID で作ると主キーに当たる
    expect(await ledger.createPrincipal()).toEqual({
      ok: false,
      error: { error_code: "internal_error" },
    });
  });
});
