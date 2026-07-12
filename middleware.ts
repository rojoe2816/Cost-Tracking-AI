import { NextRequest, NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";

function isLocalHost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

const DASHBOARD_SESSION_COOKIE = "slate_dashboard_session";
const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/clients",
  "/projects",
  "/jobs",
  "/privacy",
  "/settings",
];

function isProtectedDashboardPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "";

  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/api/v1/") &&
    !isLocalHost(host) &&
    forwardedProtocol !== "https"
  ) {
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: {
            code: "HTTPS_REQUIRED",
            message: "Slate public APIs require HTTPS.",
          },
        },
        { status: 426 },
      ),
    );
  }

  if (
    isProtectedDashboardPath(request.nextUrl.pathname) &&
    !request.cookies.has(DASHBOARD_SESSION_COOKIE)
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
