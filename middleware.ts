import { NextRequest, NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";

function isLocalHost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
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

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
