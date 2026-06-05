import { NextRequest, NextResponse } from "next/server";

// Auth checking is handled per-page in Server Components and Server Actions.
// Middleware only handles static rewrites (root → /dashboard if needed).
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
