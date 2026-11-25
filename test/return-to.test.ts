import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "../src/ui/return-to";

describe("sanitizeReturnTo", () => {
  it("同じサービスの中の道は通す", () => {
    expect(sanitizeReturnTo("/foo")).toBe("/foo");
    expect(sanitizeReturnTo("/foo/bar?x=1#top")).toBe("/foo/bar?x=1#top");
    expect(sanitizeReturnTo("/")).toBe("/");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/foo",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,x",
    "evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "\\\\evil.example",
    "",
  ])("%j は拒んで / を返す", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/");
  });

  it("null と undefined は / を返す", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo(undefined)).toBe("/");
  });
});
