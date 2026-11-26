import { afterEach, describe, expect, it, vi } from "vitest";
import { RESEND_API_URL, ResendMailSender } from "../src/mail/resend";

const API_KEY = "re_test_secret_key_123";
const MESSAGE = {
  to: "user@example.com",
  subject: "確認コード",
  text: "確認コードは 012345 です。",
};

type Call = { input: string; init: RequestInit };

const makeSender = (response: () => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const sender = new ResendMailSender({
    apiKey: API_KEY,
    from: "Tenkyu <no-reply@example.org>",
    fetch: async (input, init) => {
      calls.push({ input, init });
      return response();
    },
  });
  return { calls, sender };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResendMailSender", () => {
  it("URL、ヘッダー、本文が Resend の API の形になっている", async () => {
    const { calls, sender } = makeSender(
      () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );

    expect(await sender.send(MESSAGE)).toEqual({ status: "accepted" });

    expect(calls).toHaveLength(1);
    const { input, init } = calls[0];
    expect(input).toBe(RESEND_API_URL);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Tenkyu <no-reply@example.org>",
      to: ["user@example.com"],
      subject: "確認コード",
      text: "確認コードは 012345 です。",
    });
  });

  it("Resend がエラーを返したとき「失敗した」が返る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sender } = makeSender(
      () =>
        new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
    );
    expect(await sender.send(MESSAGE)).toEqual({ status: "failed" });
  });

  it("通信に失敗したとき「失敗した」が返る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sender } = makeSender(() => {
      throw new TypeError("network down");
    });
    expect(await sender.send(MESSAGE)).toEqual({ status: "failed" });
  });

  it("API キー・宛先・本文がログに出ない", async () => {
    const lines: string[] = [];
    for (const level of ["log", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(" "));
      });
    }
    await makeSender(() => new Response("", { status: 500 })).sender.send(
      MESSAGE,
    );
    await makeSender(() => {
      throw new TypeError(`failed with ${API_KEY}`);
    }).sender.send(MESSAGE);
    await makeSender(() => new Response("{}", { status: 200 })).sender.send(
      MESSAGE,
    );

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain(API_KEY);
      expect(line).not.toContain("user@example.com");
      expect(line).not.toContain("012345");
    }
  });

  it("API キーが空なら作れない", () => {
    expect(
      () => new ResendMailSender({ apiKey: "", from: "a@example.org" }),
    ).toThrow();
  });
});
