import type { InternalAiContextOptions } from "@/lib/internal-ai/context";

export function getProjectOptionsForClient(
  context: InternalAiContextOptions,
  clientId: string,
): Array<{ id: string; label: string }> {
  return context.projects
    .filter((project) => project.clientId === clientId)
    .map((project) => ({
      id: project.id,
      label: project.name,
    }));
}

export function getDefaultProjectIdForClient(
  context: InternalAiContextOptions,
  clientId: string,
): string {
  return getProjectOptionsForClient(context, clientId)[0]?.id ?? "";
}

export function canSubmitCompanyAiTask(input: {
  gatewayConfigured: boolean;
  loading: boolean;
  employeeId: string;
  clientId: string;
  projectId: string;
  workflowTypeId: string;
  input: string;
}): boolean {
  return (
    input.gatewayConfigured &&
    !input.loading &&
    Boolean(input.employeeId) &&
    Boolean(input.clientId) &&
    Boolean(input.projectId) &&
    Boolean(input.workflowTypeId) &&
    Boolean(input.input.trim())
  );
}

export function lookupContextLabel(
  options: Array<{ id: string; label: string }>,
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? "Unknown";
}

export const COMPANY_AI_FLOW_STEPS = [
  "Authenticating source app",
  "Validating attribution",
  "Calling model through LiteLLM",
  "Recording usage event",
] as const;
