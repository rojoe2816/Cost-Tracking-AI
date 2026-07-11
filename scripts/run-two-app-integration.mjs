import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env" });
config({ path: "mock-company-ai/.env.local" });

const prisma = new PrismaClient();
const slateBaseUrl = (process.env.SLATE_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const mockBaseUrl = (process.env.MOCK_COMPANY_BASE_URL || "http://localhost:3100").replace(
  /\/$/,
  "",
);
const apiKey = process.env.SLATE_SOURCE_APP_KEY;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".next" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }

  return files;
}

async function verifyApplicationBoundary() {
  const files = await sourceFiles("mock-company-ai");
  const forbidden = [
    /from\s+["'][^"']*@\/lib\//,
    /from\s+["'][^"']*lib\/internal-ai/,
    /from\s+["']@prisma\/client["']/,
    /processInternalAiGatewayRequest/,
  ];

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    assert(
      !forbidden.some((pattern) => pattern.test(contents)),
      `Mock app boundary violation in ${file}`,
    );
  }
}

async function main() {
  assert(apiKey, "SLATE_SOURCE_APP_KEY is missing from mock-company-ai/.env.local");
  await verifyApplicationBoundary();

  const health = await jsonRequest(`${slateBaseUrl}/api/v1/health`);
  assert(health.response.ok && health.body?.ok, "Slate health check failed");

  const employeeExternalId = `integration-employee-${Date.now()}`;
  const synced = await jsonRequest(
    `${slateBaseUrl}/api/v1/context/employees/sync`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        employees: [
          {
            externalId: employeeExternalId,
            name: "Two App Integration User",
            email: "integration@northwind.test",
            department: "Quality",
          },
        ],
      }),
    },
  );
  assert(synced.response.ok && synced.body?.synced === 1, "Employee sync failed");

  const contextResult = await jsonRequest(`${mockBaseUrl}/api/context`);
  assert(contextResult.response.ok, "Mock app could not load context through Slate");
  const context = contextResult.body;
  assert(
    context.employees.some((employee) => employee.externalId === employeeExternalId),
    "Synced employee was not visible in the mock app",
  );

  const client = context.clients[0];
  const project = context.projects.find(
    (entry) => entry.clientExternalId === client?.externalId,
  );
  const workflow = context.workflows[0];
  const model = context.models[0];
  assert(client && project && workflow && model, "Mock context is incomplete");

  const sourceAppRequestId = `two-app-${Date.now()}`;
  const requestBody = {
    employeeExternalId,
    clientExternalId: client.externalId,
    projectExternalId: project.externalId,
    workflowExternalId: workflow.externalId,
    taskType: "client_update",
    sourceAppRequestId,
    model: model.id,
    input: "Reply with one short sentence confirming the two-application workflow.",
  };

  const run = await jsonRequest(`${mockBaseUrl}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  assert(run.response.ok, `Mock app request failed with ${run.body?.error?.code ?? run.response.status}`);
  assert(typeof run.body?.response === "string" && run.body.response.length > 0, "AI response missing");
  assert(run.body.usage.totalTokens > 0, "Token usage missing");
  assert(run.body.usage.costMicros <= 100_000, "Smoke test exceeded the $0.10 budget");
  assert(run.body.attribution.employeeExternalId === employeeExternalId, "Employee attribution mismatch");

  const duplicate = await jsonRequest(`${mockBaseUrl}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  assert(
    duplicate.response.status === 409 &&
      duplicate.body?.error?.code === "DUPLICATE_SOURCE_APP_REQUEST",
    "Duplicate request did not return the expected 409",
  );

  const audit = await prisma.aiRequestAudit.findFirst({
    where: { sourceAppRequestId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      sourceAppId: true,
      clientId: true,
      projectId: true,
      workflowTypeId: true,
      taskType: true,
      externalLiteLlmRequestId: true,
      usageEvents: {
        select: {
          provider: true,
          model: true,
          totalTokens: true,
          totalCostMicros: true,
          employeeId: true,
          sourceAppId: true,
          clientId: true,
          projectId: true,
          workflowTypeId: true,
          taskType: true,
          externalLiteLlmRequestId: true,
        },
      },
    },
  });
  assert(audit?.status === "COMPLETED", "Audit was not completed");
  assert(audit.usageEvents.length === 1, "Expected exactly one usage event");
  const usage = audit.usageEvents[0];
  assert(
    audit.employeeId &&
      audit.sourceAppId &&
      audit.clientId &&
      audit.projectId &&
      audit.workflowTypeId &&
      audit.taskType &&
      audit.externalLiteLlmRequestId,
    "Audit attribution is incomplete",
  );
  assert(
    usage?.provider &&
      usage.model &&
      usage.totalTokens > 0 &&
      usage.employeeId &&
      usage.sourceAppId &&
      usage.clientId &&
      usage.projectId &&
      usage.workflowTypeId &&
      usage.taskType &&
      usage.externalLiteLlmRequestId,
    "Usage event is incomplete",
  );

  const reports = await jsonRequest(`${slateBaseUrl}/api/v1/reports/internal-ai`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  assert(reports.response.ok, "Public reports endpoint failed");
  assert(reports.body.recent.length > 0, "Reports did not update after the request");

  console.log(
    JSON.stringify(
      {
        ok: true,
        requestId: run.body.requestId,
        model: run.body.usage.model,
        provider: run.body.usage.provider,
        totalTokens: run.body.usage.totalTokens,
        costMicros: run.body.usage.costMicros,
        duplicateStatus: duplicate.response.status,
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
    await prisma.$disconnect();
  });
