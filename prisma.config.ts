// Prisma 7 configuration — connection URLs live here (not in schema.prisma).
// See: https://pris.ly/d/config-datasource
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL is used for migrations (bypasses PgBouncer / connection pooler).
    // Falls back to DATABASE_URL when DIRECT_URL is not set.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
