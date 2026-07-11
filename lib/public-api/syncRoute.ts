import "server-only";

import { authenticatePublicApiRequest } from "./auth";
import {
  checkPublicRateLimit,
  getPublicRequestId,
  publicJson,
  readPublicJsonBody,
} from "./http";
import type { ContextSyncResult } from "./context";

export async function handleContextSyncRequest(input: {
  request: Request;
  route: string;
  sync: (organizationId: string, body: unknown) => Promise<ContextSyncResult>;
}): Promise<Response> {
  const requestId = getPublicRequestId(input.request);
  const rateLimit = checkPublicRateLimit({
    request: input.request,
    route: input.route,
    maxRequests: 30,
  });

  if (!rateLimit.ok) {
    return publicJson(
      {
        requestId,
        error: { code: "RATE_LIMITED", message: "Too many sync requests." },
      },
      {
        status: 429,
        requestId,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const auth = await authenticatePublicApiRequest(input.request, "context:write");
  if (!auth.ok) {
    return publicJson(
      { requestId, error: auth.error },
      { status: auth.status, requestId },
    );
  }

  const parsedBody = await readPublicJsonBody(input.request);
  if (!parsedBody.ok) {
    return publicJson(
      {
        requestId,
        error: { code: parsedBody.code, message: parsedBody.message },
      },
      { status: 400, requestId },
    );
  }

  const result = await input.sync(auth.value.organizationId, parsedBody.value);
  if (!result.ok) {
    return publicJson(
      {
        requestId,
        error: { code: result.code, message: result.message },
      },
      { status: 400, requestId },
    );
  }

  return publicJson(
    { requestId, synced: result.count },
    { status: 200, requestId },
  );
}
