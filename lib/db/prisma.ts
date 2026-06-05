import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Resolve DB path relative to project root so it's stable regardless of cwd.
const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const databaseUrl = rawUrl.startsWith("file:./")
  ? `file:${path.resolve(process.cwd(), rawUrl.slice(7))}`
  : rawUrl;

const createPrismaClient = (): PrismaClient => {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
