import "dotenv/config";

/**
 * Local helper for exercising POST /api/ai/gateway without requiring a real provider call.
 *
 * Default (mock) mode prints a ready-to-run curl command and exits.
 * Pass --execute to perform the HTTP request (requires a valid bearer key in SOURCE_APP_API_KEY).
 *
 * Examples:
 *   npm run gateway:test
 *   SOURCE_APP_API_KEY=slate_app_sk_... npm run gateway:test -- --execute
 */

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const baseUrl = readArg("--base-url") ?? DEFAULT_BASE_URL;
  const employeeId = readArg("--employee-id") ?? "<employee-id>";
  const clientId = readArg("--client-id") ?? "<client-id>";
  const projectId = readArg("--project-id") ?? "<project-id>";
  const workflowTypeId = readArg("--workflow-type-id") ?? "<workflow-type-id>";
  const sourceAppRequestId =
    readArg("--source-app-request-id") ??
    `local-gateway-test-${Date.now()}`;

  const payload = {
    employeeId,
    clientId,
    projectId,
    workflowTypeId,
    taskType: "client_update",
    sourceAppRequestId,
    model: "gpt-4o-mini",
    input: "Reply with exactly one sentence: Slate gateway test successful.",
  };

  const curlCommand = `curl -X POST ${baseUrl}/api/ai/gateway \\
  -H "Authorization: Bearer $SOURCE_APP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload)}'`;

  console.log("Internal AI gateway local test (mock mode)");
  console.log("");
  console.log("Set SOURCE_APP_API_KEY to a dev credential (create with npm run source-app:key:create).");
  console.log("Replace placeholder IDs with seeded demo IDs from the database.");
  console.log("");
  console.log(curlCommand);
  console.log("");

  if (!hasFlag("--execute")) {
    console.log("Mock mode only — no HTTP request sent. Pass --execute to call the gateway.");
    return;
  }

  const apiKey = process.env.SOURCE_APP_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "SOURCE_APP_API_KEY is required for --execute. Create a dev key with npm run source-app:key:create.",
    );
  }

  const response = await fetch(`${baseUrl}/api/ai/gateway`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log(body);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
