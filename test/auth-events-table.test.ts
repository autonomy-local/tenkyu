import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const columns = async () => {
  const { results } = await env.DB.prepare(
    "SELECT name, \"notnull\" AS not_null FROM pragma_table_info('auth_events')",
  ).all<{ name: string; not_null: number }>();
  return results;
};

describe("auth_events の表", () => {
  it("表がある", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_events'",
    ).first<{ name: string }>();
    expect(row?.name).toBe("auth_events");
  });

  it("docs/schema.md の列がある", async () => {
    const results = await columns();
    expect(results.map((r) => r.name).sort()).toEqual(
      [
        "amr",
        "created_at",
        "event_type",
        "id",
        "result",
        "service",
        "sub",
      ].sort(),
    );
    // NULL を許すのは sub と amr だけ
    expect(
      results
        .filter((r) => r.not_null === 0)
        .map((r) => r.name)
        .sort(),
    ).toEqual(["amr", "sub"]);
  });

  it("列の名前に email や code を含むものがない", async () => {
    const names = (await columns()).map((r) => r.name.toLowerCase());
    expect(
      names.filter((n) => n.includes("email") || n.includes("code")),
    ).toEqual([]);
  });

  it("時刻で引くための索引がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_index_info('idx_auth_events_created_at')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["created_at"]);
  });
});
