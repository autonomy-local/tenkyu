import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type Column = { name: string; not_null: number; dflt_value: string | null };

const columns = async () => {
  const { results } = await env.DB.prepare(
    "SELECT name, \"notnull\" AS not_null, dflt_value FROM pragma_table_info('email_codes')",
  ).all<Column>();
  return results;
};

describe("email_codes の表", () => {
  it("表がある", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'email_codes'",
    ).first<{ name: string }>();
    expect(row?.name).toBe("email_codes");
  });

  it("docs/schema.md の列がある", async () => {
    const results = await columns();
    expect(results.map((r) => r.name).sort()).toEqual(
      [
        "attempt_count",
        "code_hash",
        "consumed_at",
        "created_at",
        "destination_hash",
        "expires_at",
        "id",
      ].sort(),
    );
    // NULL を許すのは consumed_at だけ。attempt_count の初期値は 0
    expect(results.filter((r) => r.not_null === 0).map((r) => r.name)).toEqual([
      "consumed_at",
    ]);
    expect(results.find((r) => r.name === "attempt_count")?.dflt_value).toBe(
      "0",
    );
  });

  it("宛先とコードの列の名前が _hash で終わる", async () => {
    const names = (await columns()).map((r) => r.name);
    const holdsInput = names.filter(
      (n) => n.includes("destination") || n.includes("code"),
    );
    expect(holdsInput.sort()).toEqual(["code_hash", "destination_hash"]);
    for (const name of holdsInput) expect(name).toMatch(/_hash$/);
  });

  it("宛先と期限で引くための索引がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_index_info('idx_email_codes_lookup')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "destination_hash",
      "expires_at",
    ]);
  });
});
