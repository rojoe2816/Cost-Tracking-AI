import { logger } from "@/lib/logger";

import { processInternalAiGatewayRequest } from "@/lib/internal-ai/gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Source-agnostic AI gateway for internal company tools.
 *
 * Slack must ack within 3 seconds and uses async BackgroundJob processing.
 * Internal company AI apps need the model response synchronously, so this
 * route calls LiteLLM inline and returns output + usage metadata.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const authorizationHeader = request.headers.get("authorization");
  const result = await processInternalAiGatewayRequest({
    authorizationHeader,
    body,
  });

  if (!result.ok) {
    logger.warn(
      {
        route: "/api/ai/gateway",
        status: result.status,
        code: result.value.error.code,
      },
      "Internal AI gateway request rejected",
    );
  }

  return Response.json(result.value, { status: result.status });
}

export async function GET() {
  return Response.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST for AI gateway requests.",
      },
    },
    { status: 405 },
  );
}
