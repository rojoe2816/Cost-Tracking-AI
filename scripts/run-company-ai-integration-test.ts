import "dotenv/config";

import { runCompanyAiTask } from "../lib/internal-ai/companyAiRun";

async function main() {
  const result = await runCompanyAiTask({
    employeeId: "cmqn5di88000yv0c2lafjlzpx",
    clientId: "cmq7hltt00005v001jg5loba1",
    projectId: "cmq7hltt50007v001gm6u40gr",
    workflowTypeId: "cmq7hltvu000rv001kd7hkl9l",
    taskType: "client_update",
    model: "gpt-4o-mini",
    input:
      "Reply with exactly one short sentence: Company AI platform integration successful.",
  });

  console.log(
    JSON.stringify({
      ok: result.ok,
      status: result.ok ? 200 : result.status,
      code: result.ok ? null : result.value.error.code,
      message: result.ok ? null : result.value.error.message,
      outputPreview: result.ok ? result.value.output.slice(0, 120) : null,
      auditId: result.ok ? result.value.aiRequestAuditId : null,
      spendUsd: result.ok ? result.value.usage.spendUsd : null,
      totalTokens: result.ok ? result.value.usage.totalTokens : null,
      provider: result.ok ? result.value.usage.provider : null,
      model: result.ok ? result.value.usage.model : null,
    }),
  );

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
