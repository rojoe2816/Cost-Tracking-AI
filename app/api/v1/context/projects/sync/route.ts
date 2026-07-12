import { syncProjects } from "@/lib/public-api/context";
import { handleContextSyncRequest } from "@/lib/public-api/syncRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleContextSyncRequest({
    request,
    route: "/api/v1/context/projects/sync",
    sync: syncProjects,
  });
}
