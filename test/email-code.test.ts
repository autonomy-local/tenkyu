import { describe, expect, it } from "vitest";
import {
  CODE_DIGITS,
  generateCode,
  hashCode,
  timingSafeEqualHash,
  verifyCode,
} from "../src/verifiers/email-code/code";

const KEY = "test-key";

describe("generateCode", () => {
  it("常に6桁の数字になる（先頭の0を含む）", () => {
    expect(CODE_DIGITS).toBe(6);
    let sawLeadingZero = false;
    for (let i = 0; i < 5000; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      if (code.startsWith("0")) sawLeadingZero = true;
    }
    // 先頭が0になる確率は1/10。5000回で一度も出ない確率は無視できる
    expect(sawLeadingZero).toBe(true);
  });
});

describe("hashCode", () => {
  it("同じコードのハッシュは一致する", async () => {
    expect(await hashCode("012345", KEY)).toBe(await hashCode("012345", KEY));
  });

  it("違うコードのハッシュは一致しない", async () => {
    expect(await hashCode("012345", KEY)).not.toBe(
      await hashCode("012346", KEY),
    );
  });

  it("鍵が違うとハッシュが違い、コードそのものを含まない", async () => {
    const hash = await hashCode("012345", KEY);
    expect(hash).not.toBe(await hashCode("012345", "other-key"));
    expect(hash).not.toContain("012345");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("timingSafeEqualHash / verifyCode", () => {
  it("一致・不一致・長さ違いを正しく返す", async () => {
    const stored = await hashCode("123456", KEY);
    expect(timingSafeEqualHash(stored, stored)).toBe(true);
    expect(timingSafeEqualHash(stored, stored.slice(1))).toBe(false);
    expect(await verifyCode("123456", stored, KEY)).toBe(true);
    expect(await verifyCode("123457", stored, KEY)).toBe(false);
  });
});
