import { getPublicHealthSnapshot } from "@/lib/public-api/health";
import { getPublicRequestId, publicJson } from "@/lib/public-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getPublicRequestId(request);
  const snapshot = await getPublicHealthSnapshot();

  return publicJson(
    {
      requestId,
      status: snapshot.status,
      ok: snapshot.ok,
      version: "v1",
      database: snapshot.database,
      modelGateway: snapshot.modelGateway,
      worker: snapshot.worker,
      services: {
        database: snapshot.database,
        modelGateway: snapshot.modelGateway,
        worker: snapshot.worker,
      },
    },
    { status: snapshot.ok ? 200 : 503, requestId },
  );
}
