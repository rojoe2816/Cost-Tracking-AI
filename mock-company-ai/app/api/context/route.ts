import { SlateApiError } from "@slate-ai/sdk";

import { getSlateClient } from "../../../lib/slate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await getSlateClient().getContext();
    return Response.json(context, {
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
