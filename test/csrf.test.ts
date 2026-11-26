import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  CSRF_COOKIE_NAME,
  CSRF_FIELD_NAME,
  csrfProtection,
  issueCsrfToken,
} from "../src/ui/csrf";

const app = new Hono();
app.use("*", csrfProtection());
app.get("/form", (c) => c.text(issueCsrfToken(c)));
app.post("/form", async (c) => {
  const body = await c.req.parseBody();
  return c.text(`ok:${body.name}`);
});

const getToken = async () => {
  const response = await app.request("https://example.com/form");
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  return { token: await response.text(), setCookie };
};

const post = (form: Record<string, string>, cookie?: string) =>
  app.request("https://example.com/form", {
    method: "POST",
    body: new URLSearchParams(form),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

describe("CSRF", () => {
  it("GET でトークンを作り、決めた属性のクッキーに入れる", async () => {
    const { token, setCookie } = await getToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setCookie).toContain(`${CSRF_COOKIE_NAME}=${token}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("正しいトークンの POST が通る", async () => {
    const { token } = await getToken();
    const response = await post(
      { [CSRF_FIELD_NAME]: token, name: "taro" },
      `${CSRF_COOKIE_NAME}=${token}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok:taro");
  });

  it("トークンがない POST は 403", async () => {
    expect((await post({ name: "taro" })).status).toBe(403);
  });

  it("クッキーだけ、隠し項目だけの POST は 403", async () => {
    const { token } = await getToken();
    expect(
      (await post({ name: "taro" }, `${CSRF_COOKIE_NAME}=${token}`)).status,
    ).toBe(403);
    expect((await post({ [CSRF_FIELD_NAME]: token })).status).toBe(403);
  });

  it("違うトークンの POST は 403", async () => {
    const { token } = await getToken();
    const { token: other } = await getToken();
    const response = await post(
      { [CSRF_FIELD_NAME]: other },
      `${CSRF_COOKIE_NAME}=${token}`,
    );
    expect(response.status).toBe(403);
  });

  it("GET はトークンなしで通る", async () => {
    expect((await app.request("https://example.com/form")).status).toBe(200);
  });
});
