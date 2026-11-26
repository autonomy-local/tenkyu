// テスト用の仮のサービス（engawa や Bunko の代わり）。Service Binding（TENKYU）で Tenkyu を呼ぶ。
// vitest.config.ts の miniflare.workers で、ビルドせずにそのまま読み込む。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/tenkyu/healthz") {
      // Service Binding の URL のホストは使われない。パスだけが Tenkyu に届く
      const response = await env.TENKYU.fetch(
        "https://tenkyu.internal/healthz",
      );
      return new Response(await response.text(), { status: response.status });
    }
    return new Response("Not Found", { status: 404 });
  },
};
