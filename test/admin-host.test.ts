import { env, SELF } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type AdminHostBindings, adminHostOnly } from "../src/admin/host";
import { app } from "../src/index";

const ADMIN_HOST = "admin.tenkyu.example";

// ミドルウェアの先に仮の管理の口を置いた app で、届くかどうかを見る
const probe = () => {
  const a = new Hono<{ Bindings: AdminHostBindings }>();
  a.use("/admin/api/*", adminHostOnly());
  a.get("/admin/api/ping", (c) => c.text("admin"));
  a.get("/healthz", (c) => c.text("ok"));
  return a;
};

describe("adminHostOnly", () => {
  it("管理用のホスト名の要求だけが /admin/api/* に届く", async () => {
    const res = await probe().request(
      `https://${ADMIN_HOST}/admin/api/ping`,
      {},
      { ADMIN_HOST },
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("admin");

    // 大文字・小文字の違いは同じホスト名として扱う
    const upper = await probe().request(
      "https://ADMIN.tenkyu.example/admin/api/ping",
      {},
      { ADMIN_HOST },
    );
    expect(upper.status).toBe(200);
  });

  it.each([
    ["利用者向けのホスト名", "https://engawa.example/admin/api/ping"],
    [
      "管理用のホスト名を含む別の名前",
      `https://${ADMIN_HOST}.evil.example/admin/api/ping`,
    ],
    [
      "Service Binding の内向きの名前",
      "https://tenkyu.internal/admin/api/ping",
    ],
  ])("%sの要求は 404", async (_label, url) => {
    const res = await probe().request(url, {}, { ADMIN_HOST });
    expect(res.status).toBe(404);
  });

  it("ADMIN_HOST がないときは管理用のホスト名でも 404", async () => {
    const res = await probe().request(
      `https://${ADMIN_HOST}/admin/api/ping`,
      {},
      {},
    );
    expect(res.status).toBe(404);
  });

  it("/admin/api/* の外の道は絞らない", async () => {
    const res = await probe().request(
      "https://engawa.example/healthz",
      {},
      { ADMIN_HOST },
    );
    expect(res.status).toBe(200);
  });
});

describe("Tenkyu の Worker", () => {
  it("利用者向けのホスト名で /admin/api/* を呼ぶと 404", async () => {
    const res = await app.request(
      "https://engawa.example/admin/api/principals",
      {},
      { ADMIN_HOST },
    );
    expect(res.status).toBe(404);
    expect(
      (await SELF.fetch("https://engawa.example/admin/api/x")).status,
    ).toBe(404);
  });

  it("仮のサービスから Service Binding で /admin/api/* を呼ぶと 404", async () => {
    const res = await env.SERVICE.fetch(
      "https://service.example/tenkyu/admin/api/principals",
    );
    expect(res.status).toBe(404);
    // 同じ入口から /healthz は届く（Service Binding がつながっている）
    const health = await env.SERVICE.fetch(
      "https://service.example/tenkyu/healthz",
    );
    expect(health.status).toBe(200);
  });
});
