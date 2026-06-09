import { NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";

export function middleware() {
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
