import postgres from "postgres";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
const sql = postgres(config.DATABASE_URL);

const app = createApp({ pingDb: () => sql`select 1`, version: config.RAILWAY_GIT_COMMIT_SHA });

app.listen(config.PORT, () => {
  console.log(`Suvidha backend listening on port ${config.PORT}`);
});
