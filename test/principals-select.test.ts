import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { D1PrincipalLedger } from "../src/principals/d1";
import { selectPrincipalLedger } from "../src/principals/index";
import wranglerToml from "../wrangler.toml?raw";

describe("selectPrincipalLedger", () => {
  it("設定が d1 のとき D1 の中身を選ぶ", async () => {
    const ledger = selectPrincipalLedger({
      PRINCIPALS_BACKEND: "d1",
      DB: env.DB,
    });
    expect(ledger).toBeInstanceOf(D1PrincipalLedger);
    // 選んだ中身で D1 の表を使える
    const created = await ledger.createPrincipal();
    expect(created.ok).toBe(true);
  });

  it.each([
    ["知らない値", "mizucho-typo"],
    ["空", ""],
    ["未設定", undefined],
  ])("%sのとき例外で止める", (_label, value) => {
    expect(() =>
      selectPrincipalLedger({ PRINCIPALS_BACKEND: value, DB: env.DB }),
    ).toThrow(/PRINCIPALS_BACKEND/);
  });

  it("wrangler.toml の設定は d1", () => {
    expect(wranglerToml).toMatch(/^PRINCIPALS_BACKEND = "d1"$/m);
    // テストの Worker にも同じ値が渡る
    expect((env as unknown as Record<string, unknown>).PRINCIPALS_BACKEND).toBe(
      "d1",
    );
  });
});
