import { logger } from "@/lib/logger";
import { processPublicGatewayRequest } from "@/lib/public-api/gateway";
import {
  checkPublicRateLimit,
  getPublicRequestId,
  publicJson,
  readPublicJsonBody,
} from "@/lib/public-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const traceRequestId = getPublicRequestId(request);
  const rateLimit = checkPublicRateLimit({
    request,
    route: "/api/v1/ai/gateway",
    maxRequests: 60,
  });

  if (!rateLimit.ok) {
    return publicJson(
      {
        requestId: traceRequestId,
        error: {
          code: "RATE_LIMITED",
          message: "Too many gateway requests. Retry after the indicated delay.",
        },
      },
      {
        status: 429,
        requestId: traceRequestId,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const parsedBody = await readPublicJsonBody(request);
  if (!parsedBody.ok) {
    return publicJson(
      {
        requestId: traceRequestId,
        error: { code: parsedBody.code, message: parsedBody.message },
      },
      { status: 400, requestId: traceRequestId },
    );
  }

  const result = await processPublicGatewayRequest({
    authorizationHeader: request.headers.get("authorization"),
    body: parsedBody.value,
  });

  if (!result.ok) {
    logger.warn(
      {
        route: "/api/v1/ai/gateway",
        requestId: traceRequestId,
        status: result.status,
        code: result.value.error.code,
      },
      "Public AI gateway request rejected",
    );

    return publicJson(
      { requestId: traceRequestId, ...result.value },
      { status: result.status, requestId: traceRequestId },
    );
  }

  return publicJson(
    { traceId: traceRequestId, ...result.value },
    { status: 200, requestId: traceRequestId },
  );
}

export async function GET(request: Request) {
  const requestId = getPublicRequestId(request);
  return publicJson(
    {
      requestId,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for this endpoint." },
    },
    { status: 405, requestId, headers: { Allow: "POST" } },
  );
}
