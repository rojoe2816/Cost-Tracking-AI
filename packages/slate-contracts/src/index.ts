export type SlateApiErrorBody = {
  requestId: string;
  error: {
    code: string;
    message: string;
  };
};

export type SlateModelOption = {
  id: string;
  label: string;
  provider: string;
};

export type SlateContext = {
  requestId: string;
  organization: { name: string };
  sourceApp: { name: string; type: string };
  employees: Array<{
    externalId: string;
    name: string;
    email: string | null;
    department: string | null;
    role: string | null;
  }>;
  clients: Array<{ externalId: string; name: string }>;
  projects: Array<{
    externalId: string;
    clientExternalId: string;
    name: string;
  }>;
  workflows: Array<{ externalId: string; name: string }>;
  models: SlateModelOption[];
};

export type SlateRunInput = {
  employeeExternalId: string;
  clientExternalId?: string | null;
  projectExternalId?: string | null;
  workflowExternalId?: string | null;
  taskType?: string | null;
  sourceAppRequestId: string;
  model?: string | null;
  input: string;
  metadata?: Record<string, unknown>;
  attributionPrediction?: {
    predictedWorkflowExternalId?: string | null;
    predictedTaskType?: string | null;
    confidence?: number | null;
    modelVersion?: string | null;
    wasOverridden?: boolean | null;
    requiredReview?: boolean | null;
  } | null;
};

export type SlateRunResult = {
  traceId: string;
  requestId: string;
  response: string;
  usage: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costMicros: number;
    latencyMs: number;
  };
  attribution: {
    employeeExternalId: string;
    clientExternalId: string | null;
    projectExternalId: string | null;
    workflowExternalId: string | null;
    taskType: string | null;
    sourceAppRequestId: string;
  };
};

export type EmployeeSyncInput = {
  employees: Array<{
    externalId: string;
    name: string;
    email?: string | null;
    department?: string | null;
    role?: string | null;
    isActive?: boolean;
  }>;
};

export type ClientSyncInput = {
  clients: Array<{
    externalId: string;
    name: string;
    isActive?: boolean;
  }>;
};

export type ProjectSyncInput = {
  projects: Array<{
    externalId: string;
    clientExternalId: string;
    name: string;
    isActive?: boolean;
  }>;
};

export type WorkflowSyncInput = {
  workflows: Array<{
    externalId: string;
    name: string;
  }>;
};

export type SlateSyncResult = {
  requestId: string;
  synced: number;
};
