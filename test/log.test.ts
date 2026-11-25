import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLog, type LogFields, log } from "../src/log";

const EMAIL = "taro.yamada@example.com";
const CODE = "012345";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log", () => {
  it("決めた項目を1行の JSON で出す", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", {
      event: "code_verify",
      service: "engawa",
      result: "failure",
      reason: "expired",
      requestId: "abc",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(spy.mock.calls[0][0]))).toEqual({
      level: "info",
      event: "code_verify",
      service: "engawa",
      result: "failure",
      reason: "expired",
      requestId: "abc",
    });
  });

  it("型をすり抜けて渡したメールアドレスとコードを出さない", () => {
    const lines: string[] = [];
    for (const level of ["log", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((line: string) => {
        lines.push(line);
      });
    }
    const smuggled = {
      event: "code_verify",
      email: EMAIL,
      code: CODE,
    } as unknown as LogFields;
    log("info", smuggled);
    log("warn", { event: "code_send", reason: `to ${EMAIL}` });
    log("error", { event: "code_verify", requestId: `code=${CODE}` });

    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).not.toContain(EMAIL);
      expect(line).not.toContain(CODE);
    }
  });

  it("formatLog は値のない項目を出さない", () => {
    expect(JSON.parse(formatLog("warn", { event: "logout" }))).toEqual({
      level: "warn",
      event: "logout",
    });
  });
});
