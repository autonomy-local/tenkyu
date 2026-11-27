import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// 仮のサービス（test/fixtures/service/）から Service Binding で Tenkyu を呼ぶ結合テスト
describe("Service Binding での結合", () => {
  it("仮のサービスから Tenkyu の /healthz を呼べる", async () => {
    const response = await env.SERVICE.fetch(
      "https://service.example/tenkyu/healthz",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
