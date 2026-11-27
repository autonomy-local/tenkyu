import { Hono } from "hono";
import { type AdminHostBindings, adminHostOnly } from "./admin/host";
import { purgeExpired, type RetentionEnv, retentionFromEnv } from "./retention";

type Bindings = AdminHostBindings & RetentionEnv & { DB: D1Database };

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/healthz", (c) => {
  return c.text("ok");
});

// 管理の口は、管理用のホスト名の要求でだけ受ける（src/admin/host.ts）
app.use("/admin/api/*", adminHostOnly());

export default {
  fetch: app.fetch,
  // Cron Trigger（wrangler.toml の [triggers]）。期限を過ぎた行を消す
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      purgeExpired(
        env.DB,
        Math.floor(controller.scheduledTime / 1000),
        retentionFromEnv(env),
      ),
    );
  },
} satisfies ExportedHandler<Bindings>;
