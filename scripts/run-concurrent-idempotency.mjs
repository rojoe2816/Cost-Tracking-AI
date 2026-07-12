/**
 * Live concurrent idempotency race against POST /api/v1/ai/gateway.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: "mock-company-ai/.env.local" });

const prisma = new PrismaClient();
const slateBaseUrl = (process.env.SLATE_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const apiKey = process.env.SLATE_SOURCE_APP_KEY;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(apiKey, "SLATE_SOURCE_APP_KEY missing");

  const contextResponse = await fetch(`${slateBaseUrl}/api/v1/context`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const context = await contextResponse.json();
  assert(contextResponse.ok, "context failed");

  const employee = context.employees[0];
  const client = context.clients[0];
  const project = context.projects.find(
    (row) => row.clientExternalId === client.externalId,
  );
  const workflow = context.workflows[0];
  assert(employee && client && project && workflow, "incomplete context");

  const sourceAppRequestId = `race-${Date.now()}`;
  const body = {
    employeeExternalId: employee.externalId,
    clientExternalId: client.externalId,
    projectExternalId: project.externalId,
    workflowExternalId: workflow.externalId,
    taskType: "client_update",
    sourceAppRequestId,
    model: "gpt-4o-mini",
    input: "Reply with OK.",
  };

  const [first, second] = await Promise.all([
    fetch(`${slateBaseUrl}/api/v1/ai/gateway`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    fetch(`${slateBaseUrl}/api/v1/ai/gateway`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  ]);

  const statuses = [first.status, second.status].sort();
  const auditCount = await prisma.aiRequestAudit.count({
    where: { sourceAppRequestId },
  });
  const usageCount = await prisma.aiUsageEvent.count({
    where: {
      aiRequestAudit: {
        sourceAppRequestId,
      },
    },
  });

  assert(
    statuses.includes(200) && statuses.includes(409),
    `expected 200+409, got ${statuses.join(",")}`,
  );
  assert(auditCount === 1, `expected 1 audit, got ${auditCount}`);
  assert(usageCount === 1, `expected 1 usage event, got ${usageCount}`);

  console.log(
    JSON.stringify({
      ok: true,
      statuses,
      usageCount,
      auditCount,
      sourceAppRequestId,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
