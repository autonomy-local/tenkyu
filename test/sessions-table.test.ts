import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("sessions の表", () => {
  it("表がある", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'",
    ).first<{ name: string }>();
    expect(row?.name).toBe("sessions");
  });

  it("docs/schema.md の列がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name, \"notnull\" AS not_null FROM pragma_table_info('sessions')",
    ).all<{ name: string; not_null: number }>();
    expect(results.map((r) => r.name).sort()).toEqual(
      [
        "amr",
        "auth_time",
        "created_at",
        "expires_at",
        "id",
        "last_active_at",
        "revoked_at",
        "service",
        "sub",
      ].sort(),
    );
    // NULL を許すのは revoked_at だけ
    expect(results.filter((r) => r.not_null === 0).map((r) => r.name)).toEqual([
      "revoked_at",
    ]);
  });

  it("主体とサービスで引くための索引がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_index_info('idx_sessions_sub_service')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["sub", "service"]);
  });
});
