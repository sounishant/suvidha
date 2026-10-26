import express from "express";

export type AppDeps = {
  pingDb: () => Promise<unknown>;
  version: string;
};

export function createApp(deps: AppDeps) {
  const app = express();

  app.get("/health", async (_req, res) => {
    const db = await deps.pingDb().then(
      () => "up" as const,
      () => "down" as const,
    );
    res.status(db === "up" ? 200 : 503).json({ ok: db === "up", db, version: deps.version });
  });

  return app;
}
