import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const insert = (id: string, provider: string, providerSubject: string) =>
  env.DB.prepare(
    "INSERT INTO identities (id, sub, provider, provider_subject, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, "principal-1", provider, providerSubject, 1_700_000_000)
    .run();

describe("identities の表", () => {
  it("表がある", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'identities'",
    ).first<{ name: string }>();
    expect(row?.name).toBe("identities");
  });

  it("docs/schema.md の列がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_table_info('identities')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual(
      [
        "created_at",
        "disabled_at",
        "id",
        "provider",
        "provider_subject",
        "sub",
      ].sort(),
    );
  });

  it("provider と識別子が同じ行を2回入れると失敗する", async () => {
    await insert("identity-1", "firebase", "uid-1");
    await expect(insert("identity-2", "firebase", "uid-1")).rejects.toThrow(
      /UNIQUE/,
    );
  });

  it("provider が違えば同じ識別子でも入る", async () => {
    await insert("identity-3", "firebase", "uid-2");
    await expect(
      insert("identity-4", "email_code", "uid-2"),
    ).resolves.toBeDefined();
  });
});
