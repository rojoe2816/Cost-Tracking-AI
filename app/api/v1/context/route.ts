import { authenticatePublicApiRequest } from "@/lib/public-api/auth";
import { getPublicContext } from "@/lib/public-api/context";
import {
  checkPublicRateLimit,
  getPublicRequestId,
  publicJson,
} from "@/lib/public-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getPublicRequestId(request);
  const rateLimit = checkPublicRateLimit({
    request,
    route: "/api/v1/context",
    maxRequests: 120,
  });

  if (!rateLimit.ok) {
    return publicJson(
      { requestId, error: { code: "RATE_LIMITED", message: "Too many requests." } },
      {
        status: 429,
        requestId,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const auth = await authenticatePublicApiRequest(request, "context:read");
  if (!auth.ok) {
    return publicJson(
      { requestId, error: auth.error },
      { status: auth.status, requestId },
    );
  }

  const context = await getPublicContext(auth.value);
  return publicJson({ requestId, ...context }, { status: 200, requestId });
}
