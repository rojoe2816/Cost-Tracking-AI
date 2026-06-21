import "server-only";

import { env } from "@/lib/env";
import { db } from "@/lib/db";

export interface InternalAiContextEmployee {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  role: string | null;
}

export interface InternalAiContextClient {
  id: string;
  name: string;
}

export interface InternalAiContextProject {
  id: string;
  name: string;
  clientId: string;
}

export interface InternalAiContextWorkflowType {
  id: string;
  name: string;
}

export interface InternalAiContextSourceApp {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

export interface InternalAiContextModel {
  id: string;
  label: string;
  provider: string;
}

export interface InternalAiContextOptions {
  employees: InternalAiContextEmployee[];
  clients: InternalAiContextClient[];
  projects: InternalAiContextProject[];
  workflowTypes: InternalAiContextWorkflowType[];
  sourceApps: InternalAiContextSourceApp[];
  models: InternalAiContextModel[];
}

const STATIC_MODELS: InternalAiContextModel[] = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openai",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
  },
];

function getConfiguredModels(): InternalAiContextModel[] {
  const defaultModel = env.LITELLM_DEFAULT_MODEL ?? "gpt-4o-mini";
  const hasDefault = STATIC_MODELS.some((model) => model.id === defaultModel);

  if (hasDefault) {
    return STATIC_MODELS;
  }

  return [
    {
      id: defaultModel,
      label: defaultModel,
      provider: "litellm",
    },
    ...STATIC_MODELS,
  ];
}

/**
 * Returns organization-scoped options for a future internal AI portal.
 * Never returns secrets, tokens, or prompt/response text.
 */
export async function getInternalAiContextOptions(
  organizationId: string,
): Promise<InternalAiContextOptions> {
  const [employees, clients, projects, workflowTypes, sourceApps] =
    await Promise.all([
      db.employee.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          role: true,
        },
      }),
      db.client.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.project.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, clientId: true },
      }),
      db.workflowType.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.aiSourceApp.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
        },
      }),
    ]);

  return {
    employees,
    clients,
    projects,
    workflowTypes,
    sourceApps,
    models: getConfiguredModels(),
  };
}
