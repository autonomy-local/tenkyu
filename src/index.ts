import { Hono } from "hono";
import { type AdminHostBindings, adminHostOnly } from "./admin/host";

const app = new Hono<{ Bindings: AdminHostBindings }>();

app.get("/healthz", (c) => {
  return c.text("ok");
});

// 管理の口は、管理用のホスト名の要求でだけ受ける（src/admin/host.ts）
app.use("/admin/api/*", adminHostOnly());

export default app;
