import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env"), override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
