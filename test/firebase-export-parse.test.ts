import { describe, expect, it } from "vitest";
import { parseFirebaseExport } from "../scripts/import-firebase/parse";
import fixture from "./fixtures/firebase-export.json?raw";

describe("parseFirebaseExport", () => {
  const report = parseFirebaseExport(fixture);

  it("仮の書き出しを読み、uid とメールアドレスの組にする", () => {
    expect(report.total).toBe(6);
    expect(report.users).toEqual([
      { uid: "uid-alice", email: "alice@example.com", disabled: false },
      { uid: "uid-bob", email: "bob@example.com", disabled: false },
      { uid: "uid-disabled", email: "dave@example.com", disabled: true },
    ]);
  });

  it("メールアドレスのない利用者を報告する", () => {
    expect(report.missingEmail).toEqual(["uid-no-email"]);
  });

  it("大文字・小文字だけが違うものも含め、重複を報告して取り込みに回さない", () => {
    expect(report.duplicates).toEqual([
      { email: "carol@example.com", uids: ["uid-carol-1", "uid-carol-2"] },
    ]);
    expect(report.users.map((u) => u.uid)).not.toContain("uid-carol-1");
  });

  it("パスワードのハッシュなど、使わない項目を持ち出さない", () => {
    expect(JSON.stringify(report)).not.toContain("dummy-hash");
  });

  it("users のない入力と、localId のない利用者は失敗する", () => {
    expect(() => parseFirebaseExport("{}")).toThrow();
    expect(() =>
      parseFirebaseExport({ users: [{ email: "x@example.com" }] }),
    ).toThrow();
  });
});
