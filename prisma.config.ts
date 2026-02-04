import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
      path: "prisma/migrations",
      seed: "npm run seed"
    },
    datasource: {
      url: env("DATABASE_URL"),
      ...(process.env.DIRECT_URL && { shadowDatabaseUrl: process.env.DIRECT_URL }),
    },
});
