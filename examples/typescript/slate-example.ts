import { SlateClient } from "@slate-ai/sdk";

const slate = new SlateClient({
  apiKey: process.env.SLATE_API_KEY!,
  baseUrl: process.env.SLATE_BASE_URL!,
});

const context = await slate.getContext();
const employee = context.employees[0];

if (!employee) throw new Error("Sync at least one employee first.");

const result = await slate.run({
  employeeExternalId: employee.externalId,
  sourceAppRequestId: crypto.randomUUID(),
  input: "Draft a concise internal status update.",
});

console.log(result.response);
