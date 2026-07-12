import type { SlateRunInput } from "@slate-ai/contracts";
import { SlateApiError } from "@slate-ai/sdk";

import { getSlateClient } from "../../../lib/slate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  try {
    const result = await getSlateClient().run(body as SlateRunInput);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SlateApiError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            requestId: error.requestId,
            retryable: error.retryable,
          },
        },
        { status: error.status || 503 },
      );
    }

    return Response.json(
      {
        error: {
          code: "MOCK_APP_NOT_CONFIGURED",
          message:
            error instanceof Error ? error.message : "Mock application is not configured.",
        },
      },
      { status: 503 },
    );
  }
}
