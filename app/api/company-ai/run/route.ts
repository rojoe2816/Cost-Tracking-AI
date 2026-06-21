import { logger } from "@/lib/logger";
import { runCompanyAiTask } from "@/lib/internal-ai/companyAiRun";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const result = await runCompanyAiTask(body);

  if (!result.ok) {
    logger.warn(
      {
        route: "/api/company-ai/run",
        status: result.status,
        code: result.value.error.code,
      },
      "Company AI run rejected",
    );
  }

  return Response.json(result.value, { status: result.status });
}

export async function GET() {
  return Response.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST to run a company AI task.",
      },
    },
    { status: 405 },
  );
}
