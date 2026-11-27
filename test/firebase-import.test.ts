import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { importUsers, toMappingCsv } from "../scripts/import-firebase/import";
import { parseFirebaseExport } from "../scripts/import-firebase/parse";
import { D1PrincipalLedger } from "../src/principals/d1";
import fixture from "./fixtures/firebase-export.json?raw";

const KEY = "test-hash-key";
const report = parseFirebaseExport(fixture);
const options = () => ({
  db: env.DB,
  ledger: new D1PrincipalLedger(env.DB),
  hashKey: KEY,
  now: () => 1_700_000_000,
});

const count = async (table: string): Promise<number> =>
  (
    await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{
      n: number;
    }>()
  )?.n ?? 0;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM identities").run();
  await env.DB.prepare("DELETE FROM local_session_policies").run();
  await env.DB.prepare("DELETE FROM local_principals").run();
});

describe("importUsers", () => {
  it("利用者ごとに主体と、firebase と email_code の行を作る", async () => {
    const result = await importUsers(report.users, options());
    expect(result.created).toBe(report.users.length);
    expect(await count("local_principals")).toBe(report.users.length);
    expect(await count("identities")).toBe(report.users.length * 2);

    const disabled = await env.DB.prepare(
      "SELECT provider, disabled_at FROM identities WHERE sub = ? ORDER BY provider",
    )
      .bind(result.mapping.find((m) => m.firebase_uid === "uid-disabled")?.sub)
      .all();
    // Firebase で無効だった利用者は、両方の行を無効にして入れる
    expect(disabled.results).toEqual([
      { provider: "email_code", disabled_at: 1_700_000_000 },
      { provider: "firebase", disabled_at: 1_700_000_000 },
    ]);
  });

  it("仮の一覧で2回流しても行の数が変わらず、対応表も同じ", async () => {
    const first = await importUsers(report.users, options());
    const counts = [await count("local_principals"), await count("identities")];

    const second = await importUsers(report.users, options());
    expect([
      await count("local_principals"),
      await count("identities"),
    ]).toEqual(counts);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(report.users.length);
    expect(second.mapping).toEqual(first.mapping);
  });

  it("同じメールアドレスが別の主体にあれば取り込まずに報告する", async () => {
    await importUsers(report.users.slice(0, 1), options());
    const sameEmail = [{ ...report.users[0], uid: "uid-other" }];
    const result = await importUsers(sameEmail, options());
    expect(result.emailConflicts).toEqual(["uid-other"]);
    expect(result.mapping).toEqual([]);
  });
});

describe("toMappingCsv", () => {
  it("出力の対応表にメールアドレスが含まれない", async () => {
    const result = await importUsers(report.users, options());
    const csv = toMappingCsv(result.mapping);
    expect(csv.split("\n")[0]).toBe("firebase_uid,sub");
    expect(csv.trim().split("\n")).toHaveLength(report.users.length + 1);
    expect(csv).not.toContain("@");
    for (const user of report.users) {
      expect(csv).not.toContain(user.email);
      expect(csv).toContain(user.uid);
    }
  });

  it("identities にもメールアドレスを平文で入れない", async () => {
    await importUsers(report.users, options());
    const rows = await env.DB.prepare("SELECT * FROM identities").all();
    expect(JSON.stringify(rows.results)).not.toContain("@");
  });
});
