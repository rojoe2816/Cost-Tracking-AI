import "dotenv/config";

import { db } from "@/lib/db";
import { processPublicGatewayRequest } from "@/lib/public-api/gateway";

async function main() {
  const apiKey = process.env.MOCK_COMPANY_SOURCE_APP_KEY?.trim();
  if (!apiKey) throw new Error("MOCK_COMPANY_SOURCE_APP_KEY is not configured.");

  const sourceAppRequestId = `direct-v1-smoke-${Date.now()}`;
  const body = {
    employeeExternalId: "emp_rohan",
    clientExternalId: "client-acme",
    projectExternalId: "project-seo-001",
    workflowExternalId: "client-update",
    taskType: "client_update",
    sourceAppRequestId,
    model: "gpt-4o-mini",
    input: "Reply with one short sentence confirming the Slate gateway smoke test.",
  };

  const result = await processPublicGatewayRequest({
    authorizationHeader: `Bearer ${apiKey}`,
    body,
  });
  if (!result.ok) {
    throw new Error(`Gateway failed: ${result.value.error.code}`);
  }
  if (result.value.usage.totalTokens <= 0) throw new Error("Token usage was not captured.");
  if (result.value.usage.costMicros > 100_000) {
    throw new Error("Smoke test exceeded the $0.10 budget.");
  }

  const duplicate = await processPublicGatewayRequest({
    authorizationHeader: `Bearer ${apiKey}`,
    body,
  });
  if (duplicate.ok || duplicate.status !== 409) {
    throw new Error("Duplicate request did not return 409.");
  }

  const audit = await db.aiRequestAudit.findFirst({
    where: { sourceAppRequestId },
    select: {
      status: true,
      externalLiteLlmRequestId: true,
      employeeId: true,
      sourceAppId: true,
      clientId: true,
      projectId: true,
      workflowTypeId: true,
      taskType: true,
      usageEvents: {
        select: {
          provider: true,
          model: true,
          totalTokens: true,
          totalCostMicros: true,
          externalLiteLlmRequestId: true,
        },
      },
    },
  });

  if (!audit || audit.status !== "COMPLETED") throw new Error("Audit was not completed.");
  if (audit.usageEvents.length !== 1) throw new Error("Expected one usage event.");
  if (
    !audit.externalLiteLlmRequestId ||
    !audit.employeeId ||
    !audit.sourceAppId ||
    !audit.clientId ||
    !audit.projectId ||
    !audit.workflowTypeId ||
    !audit.taskType
  ) {
    throw new Error("Audit attribution is incomplete.");
  }

  const usage = audit.usageEvents[0];
  if (!usage?.provider || !usage.model || !usage.externalLiteLlmRequestId) {
    throw new Error("Usage provider reconciliation is incomplete.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        requestId: result.value.requestId,
        model: result.value.usage.model,
        provider: result.value.usage.provider,
        totalTokens: result.value.usage.totalTokens,
        costMicros: result.value.usage.costMicros,
        duplicateStatus: duplicate.status,
        auditStatus: audit.status,
        usageEvents: audit.usageEvents.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
