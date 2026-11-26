import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("yope_token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDashboardRoute =
    pathname === "/" ||
    pathname.startsWith("/contents") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/posts") ||
    pathname.startsWith("/settings");

  const hasClaimToken = request.nextUrl.searchParams.has("claim_token");
  if (!token && isDashboardRoute && !hasClaimToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isAuthRoute) {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/contents/:path*",
    "/studio/:path*",
    "/library/:path*",
    "/calendar/:path*",
    "/posts/:path*",
    "/settings/:path*",
  ],
};
