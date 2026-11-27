import { Hono } from "hono";

type Bindings = { DB: D1Database };

/** 1回に返す記録の件数の既定と上限 */
export const EVENTS_DEFAULT_LIMIT = 50;
export const EVENTS_MAX_LIMIT = 200;

export type PrincipalEvent = {
  id: string;
  event_type: string;
  service: string;
  amr: string | null;
  result: string;
  created_at: number;
};

/**
 * 管理の口：主体の認証の記録の照会（今-19d）。`GET /principals/:id/events?limit=` で、
 * その主体の auth_events を新しい順に返す。`limit` は 1〜200（既定 50）。範囲の外は上限・下限にそろえる。
 * Access の JWT（accessAuth）と管理用のホスト名（adminHostOnly）は、これを載せる側で前に付ける。
 */
export const principalEventsRoutes = () => {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.get("/principals/:id/events", async (c) => {
    const raw = Number.parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isNaN(raw)
      ? EVENTS_DEFAULT_LIMIT
      : Math.min(Math.max(raw, 1), EVENTS_MAX_LIMIT);
    const { results } = await c.env.DB.prepare(
      "SELECT id, event_type, service, amr, result, created_at FROM auth_events WHERE sub = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    )
      .bind(c.req.param("id"), limit)
      .all<PrincipalEvent>();
    return c.json({ events: results, limit });
  });
  return routes;
};
