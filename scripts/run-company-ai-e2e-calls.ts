import "dotenv/config";

import { runCompanyAiTask } from "../lib/internal-ai/companyAiRun";
import { COMPANY_AI_EXAMPLE_PROMPTS } from "../lib/internal-ai/companyAiRunTypes";

const TASK_IDS = {
  employeeId: "cmqn5di88000yv0c2lafjlzpx",
  clientId: "cmq7hltt00005v001jg5loba1",
  projectId: "cmq7hltt50007v001gm6u40gr",
  workflowTypeId: "cmq7hltvu000rv001kd7hkl9l",
};

async function main() {
  const results: Array<{
    label: string;
    ok: boolean;
    status: number;
    spendUsd: number | null;
    totalTokens: number | null;
  }> = [];

  for (const example of COMPANY_AI_EXAMPLE_PROMPTS.slice(0, 4)) {
    const result = await runCompanyAiTask({
      ...TASK_IDS,
      taskType: example.taskType,
      model: "gpt-4o-mini",
      input: example.input,
    });

    results.push({
      label: example.label,
      ok: result.ok,
      status: result.ok ? 200 : result.status,
      spendUsd: result.ok ? result.value.usage.spendUsd : null,
      totalTokens: result.ok ? result.value.usage.totalTokens : null,
    });

    if (!result.ok) {
      console.log(JSON.stringify({ results, failed: example.label }));
      process.exit(1);
    }
  }

  console.log(JSON.stringify({ calls: results.length, results }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
