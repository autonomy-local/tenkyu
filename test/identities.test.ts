import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { disable, findPrincipalId, link } from "../src/identities";

describe("identities の関数", () => {
  it("ひもづけたあとに引くと主体の ID が返る", async () => {
    const linked = await link(env.DB, "principal-a", "firebase", "uid-a");
    expect(linked.ok).toBe(true);
    expect(await findPrincipalId(env.DB, "firebase", "uid-a")).toBe(
      "principal-a",
    );
  });

  it("ひもづけていない組を引くと null", async () => {
    expect(await findPrincipalId(env.DB, "firebase", "uid-none")).toBeNull();
  });

  it("手段が違えば同じ識別子でも別の組として扱う", async () => {
    await link(env.DB, "principal-b", "firebase", "uid-b");
    expect(await findPrincipalId(env.DB, "passkey", "uid-b")).toBeNull();
  });

  it("無効化したあとに引くと見つからない", async () => {
    const linked = await link(env.DB, "principal-c", "passkey", "cred-c", {
      now: () => 1_700_000_000,
    });
    if (!linked.ok) throw new Error("ひもづけに失敗した");
    expect(await disable(env.DB, linked.id, { now: () => 1_700_000_100 })).toBe(
      true,
    );
    expect(await findPrincipalId(env.DB, "passkey", "cred-c")).toBeNull();
    const row = await env.DB.prepare(
      "SELECT disabled_at FROM identities WHERE id = ?",
    )
      .bind(linked.id)
      .first<{ disabled_at: number }>();
    expect(row?.disabled_at).toBe(1_700_000_100);
  });

  it("無効化済み・ない行の無効化は false", async () => {
    const linked = await link(env.DB, "principal-d", "passkey", "cred-d");
    if (!linked.ok) throw new Error("ひもづけに失敗した");
    expect(await disable(env.DB, linked.id)).toBe(true);
    expect(await disable(env.DB, linked.id)).toBe(false);
    expect(await disable(env.DB, "no-such-id")).toBe(false);
  });

  it("同じ組を2回ひもづけると already_linked が返り、最初の主体のまま", async () => {
    await link(env.DB, "principal-e", "email_code", "dest-e");
    expect(await link(env.DB, "principal-f", "email_code", "dest-e")).toEqual({
      ok: false,
      error: "already_linked",
    });
    expect(await findPrincipalId(env.DB, "email_code", "dest-e")).toBe(
      "principal-e",
    );
  });
});
