import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("yope_token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDashboardRoute =
    pathname === "/" ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/settings");

  if (!token && isDashboardRoute) {
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
    "/campaigns/:path*",
    "/studio/:path*",
    "/library/:path*",
    "/schedule/:path*",
    "/settings/:path*",
  ],
};
