import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";

// Tenkyu から仮の台帳（test/fixtures/ledger/）を Service Binding で呼ぶ結合テスト
const BASE = "https://ledger.internal";

const call = (path: string, init?: RequestInit) =>
  env.LEDGER.fetch(`${BASE}${path}`, init);

const setMode = async (body: Record<string, unknown>) => {
  const response = await call("/__control", {
    method: "POST",
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
};

const createPrincipal = async (): Promise<string> => {
  const response = await call("/principals", { method: "POST" });
  expect(response.status).toBe(201);
  const body = await response.json<{ principal_id: string }>();
  return body.principal_id;
};

afterEach(async () => {
  await setMode({ mode: "reset" });
});

describe("仮の台帳（Service Binding）", () => {
  it("主体の作成・照会・セッションの制限を返す", async () => {
    const created = await call("/principals", { method: "POST" });
    expect(created.status).toBe(201);
    const body = await created.json<Record<string, unknown>>();
    expect(body).toMatchObject({ status: "active" });
    expect(typeof body.created_at).toBe("number");
    const id = body.principal_id as string;

    const found = await call(`/principals/${id}`);
    expect(await found.json()).toEqual({ principal_id: id, status: "active" });

    const policy = await call(
      `/principals/${id}/session-policy?service=engawa`,
    );
    expect(await policy.json()).toEqual({
      max_concurrent_sessions: 1,
      idle_timeout_seconds: 1800,
    });
  });

  it("ない主体と形の違う ID は、約束の失敗の種類を返す", async () => {
    const missing = await call(`/principals/${crypto.randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error_code: "principal_not_found" });

    const invalid = await call("/principals/not-a-uuid");
    expect(await invalid.json()).toEqual({
      error_code: "invalid_principal_id",
    });
  });

  it("エラーを返すふるまいに切り替えられる", async () => {
    const id = await createPrincipal();
    await setMode({ mode: "error" });
    const response = await call(`/principals/${id}`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error_code: "internal_error" });

    await setMode({ mode: "normal" });
    expect((await call(`/principals/${id}`)).status).toBe(200);
  });

  it("応えないふるまいに切り替えられる", async () => {
    await setMode({ mode: "hang", delayMs: 1000 });
    const pending = call("/principals", { method: "POST" });
    const first = await Promise.race([
      pending.then(() => "answered"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 200)),
    ]);
    expect(first).toBe("timeout");
    // 待ちきれば、応えなかった扱いの 504 が返る
    expect((await pending).status).toBe(504);
  });
});
