import "server-only";

import { db } from "@/lib/db";

const MAX_TASK_TYPE_LENGTH = 80;

export type InternalAiAttributionInput = {
  organizationId: string;
  employeeId?: string | null;
  sourceAppId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
  taskType?: string | null;
  promptText?: string | null;
  responseText?: string | null;
  rawPrompt?: string | null;
  rawResponse?: string | null;
};

export type ValidatedInternalAiAttribution = {
  organizationId: string;
  employeeId: string | null;
  sourceAppId: string | null;
  clientId: string | null;
  projectId: string | null;
  workflowTypeId: string | null;
  taskType: string | null;
};

export type InternalAiAttributionErrorCode =
  | "PROMPT_OR_RESPONSE_NOT_ALLOWED"
  | "INVALID_TASK_TYPE"
  | "ORGANIZATION_NOT_FOUND"
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_INACTIVE"
  | "SOURCE_APP_NOT_FOUND"
  | "SOURCE_APP_INACTIVE"
  | "CLIENT_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_CLIENT_MISMATCH"
  | "WORKFLOW_TYPE_NOT_FOUND";

export type InternalAiAttributionResult =
  | { ok: true; value: ValidatedInternalAiAttribution }
  | {
      ok: false;
      error: {
        code: InternalAiAttributionErrorCode;
        message: string;
      };
    };

function reject(
  code: InternalAiAttributionErrorCode,
  message: string,
): InternalAiAttributionResult {
  return { ok: false, error: { code, message } };
}

function normalizeTaskType(
  taskType: string | null | undefined,
): string | null {
  if (taskType == null) {
    return null;
  }

  const trimmed = taskType.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_TASK_TYPE_LENGTH) {
    return trimmed.slice(0, MAX_TASK_TYPE_LENGTH);
  }

  return trimmed.toLowerCase();
}

function containsPromptOrResponseText(
  input: InternalAiAttributionInput,
): boolean {
  return Boolean(
    input.promptText?.trim() ||
      input.responseText?.trim() ||
      input.rawPrompt?.trim() ||
      input.rawResponse?.trim(),
  );
}

/**
 * Validates internal AI attribution metadata before gateway or usage writes.
 * Does not call LiteLLM, enqueue jobs, or persist prompt/response text.
 */
export async function validateInternalAiAttribution(
  input: InternalAiAttributionInput,
): Promise<InternalAiAttributionResult> {
  if (containsPromptOrResponseText(input)) {
    return reject(
      "PROMPT_OR_RESPONSE_NOT_ALLOWED",
      "Prompt and response text are not accepted by attribution validation.",
    );
  }

  const organization = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });

  if (!organization) {
    return reject("ORGANIZATION_NOT_FOUND", "Organization not found.");
  }

  if (input.employeeId) {
    const employee = await db.employee.findFirst({
      where: {
        id: input.employeeId,
        organizationId: input.organizationId,
      },
      select: { id: true, isActive: true },
    });

    if (!employee) {
      return reject(
        "EMPLOYEE_NOT_FOUND",
        "Employee not found for this organization.",
      );
    }

    if (!employee.isActive) {
      return reject("EMPLOYEE_INACTIVE", "Employee is inactive.");
    }
  }

  if (input.sourceAppId) {
    const sourceApp = await db.aiSourceApp.findFirst({
      where: {
        id: input.sourceAppId,
        organizationId: input.organizationId,
      },
      select: { id: true, isActive: true },
    });

    if (!sourceApp) {
      return reject(
        "SOURCE_APP_NOT_FOUND",
        "Source app not found for this organization.",
      );
    }

    if (!sourceApp.isActive) {
      return reject("SOURCE_APP_INACTIVE", "Source app is inactive.");
    }
  }

  if (input.clientId) {
    const client = await db.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });

    if (!client) {
      return reject("CLIENT_NOT_FOUND", "Client not found for this organization.");
    }
  }

  if (input.projectId) {
    const project = await db.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId,
      },
      select: { id: true, clientId: true },
    });

    if (!project) {
      return reject(
        "PROJECT_NOT_FOUND",
        "Project not found for this organization.",
      );
    }

    if (input.clientId && project.clientId !== input.clientId) {
      return reject(
        "PROJECT_CLIENT_MISMATCH",
        "Project does not belong to the selected client.",
      );
    }
  }

  if (input.workflowTypeId) {
    const workflowType = await db.workflowType.findFirst({
      where: {
        id: input.workflowTypeId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });

    if (!workflowType) {
      return reject(
        "WORKFLOW_TYPE_NOT_FOUND",
        "Workflow type not found for this organization.",
      );
    }
  }

  const normalizedTaskType = normalizeTaskType(input.taskType);

  if (input.taskType != null && input.taskType.trim() && !normalizedTaskType) {
    return reject("INVALID_TASK_TYPE", "Task type is invalid.");
  }

  return {
    ok: true,
    value: {
      organizationId: input.organizationId,
      employeeId: input.employeeId ?? null,
      sourceAppId: input.sourceAppId ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
      taskType: normalizedTaskType,
    },
  };
}
