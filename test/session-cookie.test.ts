import { describe, expect, it } from "vitest";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionCookie,
  SESSION_COOKIE_NAME,
} from "../src/sessions/cookie";

const attributes = (cookie: string) =>
  cookie
    .split(";")
    .slice(1)
    .map((part) => part.trim());

describe("buildSessionCookie", () => {
  const cookie = buildSessionCookie("abc123");

  it("名前が __Host- で始まり、値が入る", () => {
    expect(SESSION_COOKIE_NAME.startsWith("__Host-")).toBe(true);
    expect(cookie.split(";")[0]).toBe(`${SESSION_COOKIE_NAME}=abc123`);
  });

  it("HttpOnly が付く", () => {
    expect(attributes(cookie)).toContain("HttpOnly");
  });

  it("Secure が付く", () => {
    expect(attributes(cookie)).toContain("Secure");
  });

  it("SameSite=Lax が付く", () => {
    expect(attributes(cookie)).toContain("SameSite=Lax");
  });

  it("Path=/ が付く", () => {
    expect(attributes(cookie)).toContain("Path=/");
  });

  it("Domain を付けない（__Host- の決まり）", () => {
    expect(attributes(cookie).some((a) => /^domain=/i.test(a))).toBe(false);
  });

  it("Max-Age を指定できる", () => {
    expect(
      attributes(buildSessionCookie("x", { maxAgeSeconds: 60 })),
    ).toContain("Max-Age=60");
  });
});

describe("readSessionCookie", () => {
  const request = (cookie?: string) =>
    new Request("https://example.com/", {
      headers: cookie ? { Cookie: cookie } : {},
    });

  it("ほかのクッキーが混ざっていても正しい値を返す", () => {
    expect(
      readSessionCookie(
        request(
          `theme=dark; x${SESSION_COOKIE_NAME}=wrong; ${SESSION_COOKIE_NAME}=abc123; lang=ja`,
        ),
      ),
    ).toBe("abc123");
  });

  it("クッキーがなければ null を返す", () => {
    expect(readSessionCookie(request())).toBeNull();
    expect(readSessionCookie(request("theme=dark"))).toBeNull();
  });
});

describe("buildClearSessionCookie", () => {
  it("過去の期限になっていて、値が空", () => {
    const cookie = buildClearSessionCookie();
    expect(cookie.split(";")[0]).toBe(`${SESSION_COOKIE_NAME}=`);
    const parts = attributes(cookie);
    expect(parts).toContain("Max-Age=0");
    const expires = parts.find((a) => a.startsWith("Expires="));
    expect(expires).toBeDefined();
    expect(Date.parse(expires?.slice("Expires=".length) ?? "")).toBeLessThan(
      Date.now(),
    );
    expect(parts).toEqual(
      expect.arrayContaining(["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]),
    );
  });
});
