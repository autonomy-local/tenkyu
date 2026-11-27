import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import schemaDoc from "../docs/schema.md?raw";

type Column = {
  name: string;
  type: string;
  not_null: number;
  dflt_value: string | null;
};

const columns = async (table: string) => {
  const { results } = await env.DB.prepare(
    `SELECT name, type, "notnull" AS not_null, dflt_value FROM pragma_table_info('${table}')`,
  ).all<Column>();
  return results;
};

// docs/schema.md の、見出しに表の名前がある節の「列一覧」の列名を読む
const columnsInDoc = (table: string): string[] => {
  const section =
    schemaDoc
      .split(new RegExp(`### \\d+\\. \`${table}\``))[1]
      ?.split("\n---")[0] ?? "";
  return section
    .split("\n")
    .map((line) => /^\| `([a-z_]+)` \|/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
};

describe("passkeys の表", () => {
  it("資格情報の ID、公開鍵、署名の回数、名前、日時の列がある", async () => {
    const results = await columns("passkeys");
    expect(results.map((r) => r.name).sort()).toEqual(
      [
        "created_at",
        "credential_id",
        "id",
        "last_used_at",
        "name",
        "public_key",
        "sign_count",
        "sub",
      ].sort(),
    );
    expect(results.filter((r) => r.not_null === 0).map((r) => r.name)).toEqual([
      "last_used_at",
    ]);
    expect(results.find((r) => r.name === "public_key")?.type).toBe("BLOB");
    expect(results.find((r) => r.name === "sign_count")?.dflt_value).toBe("0");
  });

  it("同じ資格情報の ID は二重に入らない", async () => {
    const insert = (id: string) =>
      env.DB.prepare(
        "INSERT INTO passkeys (id, sub, credential_id, public_key, name, created_at) VALUES (?, 'p-1', 'cred-1', x'01', '端末', 1)",
      )
        .bind(id)
        .run();
    await insert("row-1");
    await expect(insert("row-2")).rejects.toThrow(/UNIQUE/);
  });

  it("主体で引く索引がある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_index_info('idx_passkeys_sub')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["sub"]);
  });
});

describe("passkey_challenges の表", () => {
  it("値のハッシュ、期限、使用済みの列がある", async () => {
    const results = await columns("passkey_challenges");
    expect(results.map((r) => r.name).sort()).toEqual(
      ["challenge_hash", "consumed_at", "expires_at"].sort(),
    );
    expect(results.filter((r) => r.not_null === 0).map((r) => r.name)).toEqual([
      "consumed_at",
    ]);
  });
});

describe("docs/schema.md", () => {
  it.each(["passkeys", "passkey_challenges"])(
    "%s の列一覧が、表の列と一致する",
    async (table) => {
      const inDoc = columnsInDoc(table);
      expect(inDoc.length).toBeGreaterThan(0);
      expect(inDoc.sort()).toEqual(
        (await columns(table)).map((r) => r.name).sort(),
      );
    },
  );
});
