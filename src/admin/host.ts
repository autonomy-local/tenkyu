import type { MiddlewareHandler } from "hono";

/** 管理用のホスト名を読む設定の名前（Workers の vars）。配備先ごとの値なので wrangler.toml には書かず、配備の設定（Pulumi）で入れる */
export const ADMIN_HOST_VAR = "ADMIN_HOST";

export type AdminHostBindings = { ADMIN_HOST?: string };

/**
 * 管理用のホスト名（`ADMIN_HOST`）への要求だけを通し、それ以外は 404 にするミドルウェア。
 * 利用者向けの入口（Service Binding）から管理の口に届かないようにする（今-19b）。
 * `ADMIN_HOST` がないときは、どの要求も通さない（安全側に倒す）。
 * 要求の URL は呼ぶ側が決められるので、これだけでは守りにならない。Access の JWT の検証（src/admin/access.ts）と重ねて使う。
 */
export const adminHostOnly =
  (): MiddlewareHandler<{ Bindings: AdminHostBindings }> => async (c, next) => {
    const adminHost = c.env?.ADMIN_HOST?.trim().toLowerCase();
    const host = new URL(c.req.url).hostname.toLowerCase();
    if (!adminHost || host !== adminHost) return c.notFound();
    await next();
  };
