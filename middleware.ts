import { auth } from "@/auth";

// Protect app routes; allow auth pages and NextAuth API through.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);

  const isPublic =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublic && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
