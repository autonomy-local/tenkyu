import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /healthz", () => {
  it("200 ok を返す", async () => {
    const response = await SELF.fetch("http://example.com/healthz");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
