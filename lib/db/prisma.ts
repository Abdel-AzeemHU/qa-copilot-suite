import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL env var is not set. See .env.local.example for setup instructions.",
  );
}

const createPrismaClient = (): PrismaClient => {
  const url = process.env.DATABASE_URL!;

  if (url.startsWith("file:")) {
    // Local dev: SQLite. The adapter takes a { url } config (it opens the
    // better-sqlite3 connection internally) — do NOT pass a Database instance.
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  // Production: Postgres.
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
