import {
  getRecentInternalAiUsage,
  getSpendByEmployee,
  getSpendBySourceApp,
  getSpendByTaskType,
} from "@/lib/analytics/internalUsage";
import { authenticatePublicApiRequest } from "@/lib/public-api/auth";
import {
  checkPublicRateLimit,
  getPublicRequestId,
  publicJson,
} from "@/lib/public-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withoutInternalId<T extends { id: unknown }>(row: T): Omit<T, "id"> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "id"),
  ) as Omit<T, "id">;
}

export async function GET(request: Request) {
  const requestId = getPublicRequestId(request);
  const rateLimit = checkPublicRateLimit({
    request,
    route: "/api/v1/reports/internal-ai",
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

  const auth = await authenticatePublicApiRequest(request, "reports:read");
  if (!auth.ok) {
    return publicJson(
      { requestId, error: auth.error },
      { status: auth.status, requestId },
    );
  }

  const [byEmployee, bySourceApp, byTaskType, recent] = await Promise.all([
    getSpendByEmployee(auth.value.organizationId),
    getSpendBySourceApp(auth.value.organizationId),
    getSpendByTaskType(auth.value.organizationId),
    getRecentInternalAiUsage(auth.value.organizationId),
  ]);

  return publicJson(
    {
      requestId,
      byEmployee: byEmployee.map(withoutInternalId),
      bySourceApp: bySourceApp.map(withoutInternalId),
      byTaskType: byTaskType.map(withoutInternalId),
      recent: recent.map(withoutInternalId),
    },
    { status: 200, requestId },
  );
}
