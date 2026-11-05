import { Hono } from "hono";

const app = new Hono();

app.get("/healthz", (c) => {
  return c.text("ok");
});

export default app;
