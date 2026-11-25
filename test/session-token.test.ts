import { describe, expect, it } from "vitest";
import {
  generateSessionId,
  hashSessionId,
  SESSION_ID_BYTES,
} from "../src/sessions/token";

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

describe("generateSessionId", () => {
  it("32バイト以上の長さの ID を作る", () => {
    expect(SESSION_ID_BYTES).toBeGreaterThanOrEqual(32);
    const id = generateSessionId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(id).length).toBe(SESSION_ID_BYTES);
  });

  it("1000回作って重ならない", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(generateSessionId());
    expect(ids.size).toBe(1000);
  });
});

describe("hashSessionId", () => {
  it("同じ ID のハッシュは同じで、ID そのものとは違う", async () => {
    const id = generateSessionId();
    const first = await hashSessionId(id);
    const second = await hashSessionId(id);
    expect(first).toBe(second);
    expect(first).not.toBe(id);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("違う ID のハッシュは違う", async () => {
    expect(await hashSessionId(generateSessionId())).not.toBe(
      await hashSessionId(generateSessionId()),
    );
  });
});
