import type { NextAuthConfig } from "next-auth";

// Lightweight config used by middleware (Edge-compatible — no Prisma, no bcrypt).
// Callbacks live only in auth.ts to avoid duplication.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
};
