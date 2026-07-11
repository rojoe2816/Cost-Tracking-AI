import { db } from "@/lib/db";
import { getLiteLLMRuntimeConfig } from "@/lib/litellm/client";
import { getPublicRequestId, publicJson } from "@/lib/public-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function databaseHealthy(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestId = getPublicRequestId(request);
  const database = await databaseHealthy();
  const litellm = getLiteLLMRuntimeConfig().status;
  const healthy = database && litellm !== "missing";

  return publicJson(
    {
      requestId,
      ok: healthy,
      version: "v1",
      services: {
        database: database ? "healthy" : "unavailable",
        modelGateway: litellm,
      },
    },
    { status: healthy ? 200 : 503, requestId },
  );
}
