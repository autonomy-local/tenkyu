// テスト用の仮の台帳（Mizucho の代わり）。docs/ledger-contract.md の3つの口を返す。
// vitest.config.ts の miniflare.workers で、ビルドせずにそのまま読み込み、Tenkyu から Service Binding（LEDGER）で呼ぶ。
//
// 口（HTTP の形は仮の台帳のもの。Mizucho の実際の形は今-9c で合わせる）：
//   POST /principals                                  1. 主体の作成
//   GET  /principals/:id                              2. 主体の照会
//   GET  /principals/:id/session-policy?service=...   3. セッションの制限の取得
//
// 応えないふるまいの切り替え（テストから呼ぶ）：
//   POST /__control  {"mode":"normal"}                 ふつうに応える
//   POST /__control  {"mode":"error"}                  どの口も 503 と internal_error を返す
//   POST /__control  {"mode":"hang","delayMs":1000}    delayMs のあいだ応えず、そのあと 504 を返す
//   POST /__control  {"mode":"reset"}                  ふつうに戻し、主体を全部消す

const DEFAULT_POLICY = {
  max_concurrent_sessions: 1,
  idle_timeout_seconds: 1800,
};

let mode = { mode: "normal", delayMs: 0 };
/** @type {Map<string, {status: string, policies: Record<string, object>}>} */
const principals = new Map();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (error_code, status) => json({ error_code }, status);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const control = async (request) => {
  const body = await request.json();
  if (body.mode === "reset") {
    mode = { mode: "normal", delayMs: 0 };
    principals.clear();
  } else if (["normal", "error", "hang"].includes(body.mode)) {
    mode = { mode: body.mode, delayMs: Number(body.delayMs ?? 0) };
  } else {
    return error("unknown_mode", 400);
  }
  return json({ mode: mode.mode });
};

const ledger = (request, url) => {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "principals") return error("not_found", 404);

  if (parts.length === 1 && request.method === "POST") {
    const principal_id = crypto.randomUUID();
    principals.set(principal_id, { status: "active", policies: {} });
    return json(
      {
        principal_id,
        status: "active",
        created_at: Math.floor(Date.now() / 1000),
      },
      201,
    );
  }

  const id = parts[1] ?? "";
  if (!UUID.test(id)) return error("invalid_principal_id", 400);
  const principal = principals.get(id);
  if (!principal) return error("principal_not_found", 404);

  if (parts.length === 2 && request.method === "GET") {
    return json({ principal_id: id, status: principal.status });
  }
  if (parts.length === 3 && parts[2] === "session-policy") {
    const service = url.searchParams.get("service") ?? "";
    if (service === "") return error("service_not_allowed", 400);
    return json(principal.policies[service] ?? DEFAULT_POLICY);
  }
  return error("not_found", 404);
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/__control" && request.method === "POST") {
      return control(request);
    }
    if (mode.mode === "error") return error("internal_error", 503);
    if (mode.mode === "hang") {
      await sleep(mode.delayMs);
      return error("internal_error", 504);
    }
    return ledger(request, url);
  },
};
