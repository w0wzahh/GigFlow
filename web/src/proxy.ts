import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/", "/login", "/register", "/forgot-password", "/reset-password",
  "/verify-email", "/privacy", "/terms", "/cookies",
]);

/**
 * Coarse auth gate: redirects based on the presence of the session cookie.
 * The cookie value is verified server-side in layouts/API handlers — this is
 * only a navigation guard so unauthenticated users don't hit dead pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get("gigflow_session")?.value;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const isApi = pathname.startsWith("/api");

  if (!hasSession && !isPublic && !isApi) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
