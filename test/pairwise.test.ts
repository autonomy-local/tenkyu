import { describe, expect, it } from "vitest";
import { pairwiseSub, pairwiseSubFromEnv } from "../src/pairwise";

const KEY = "test-pairwise-key";

describe("pairwiseSub", () => {
  it("同じ主体・同じ相手で同じ値になる", async () => {
    expect(await pairwiseSub("principal-1", "rp.example", KEY)).toBe(
      await pairwiseSub("principal-1", "rp.example", KEY),
    );
  });

  it("違う相手で違う値になる", async () => {
    expect(await pairwiseSub("principal-1", "rp-a.example", KEY)).not.toBe(
      await pairwiseSub("principal-1", "rp-b.example", KEY),
    );
  });

  it("違う主体で違う値になる", async () => {
    expect(await pairwiseSub("principal-1", "rp.example", KEY)).not.toBe(
      await pairwiseSub("principal-2", "rp.example", KEY),
    );
  });

  it("鍵が違うと値が変わる", async () => {
    expect(await pairwiseSub("principal-1", "rp.example", KEY)).not.toBe(
      await pairwiseSub("principal-1", "rp.example", "another-key"),
    );
  });

  it("区切りをずらした入力で同じ値にならない", async () => {
    expect(await pairwiseSub("bc", "a", KEY)).not.toBe(
      await pairwiseSub("c", "ab", KEY),
    );
  });

  it("主体の ID をそのまま含まない", async () => {
    const sub = await pairwiseSub("principal-1", "rp.example", KEY);
    expect(sub).not.toContain("principal-1");
    expect(sub).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("鍵が空なら失敗する", async () => {
    await expect(
      pairwiseSub("principal-1", "rp.example", ""),
    ).rejects.toThrow();
  });

  it("環境の PAIRWISE_KEY を使う", async () => {
    expect(
      await pairwiseSubFromEnv(
        { PAIRWISE_KEY: KEY },
        "principal-1",
        "rp.example",
      ),
    ).toBe(await pairwiseSub("principal-1", "rp.example", KEY));
  });
});
