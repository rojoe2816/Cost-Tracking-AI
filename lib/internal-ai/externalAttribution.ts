import "server-only";

import { db } from "@/lib/db";

import type { InternalAiGatewayRequest } from "./gatewayTypes";

export type ResolvedGatewayAttribution = {
  employeeId: string | null;
  clientId: string | null;
  projectId: string | null;
  workflowTypeId: string | null;
};

export type GatewayAttributionResolutionResult =
  | { ok: true; value: ResolvedGatewayAttribution }
  | { ok: false; error: { code: string; message: string } };

function notFound(code: string, label: string): GatewayAttributionResolutionResult {
  return {
    ok: false,
    error: {
      code,
      message: `${label} was not found for this organization.`,
    },
  };
}

/** Resolve customer-owned identifiers only after source-app authentication. */
export async function resolveGatewayAttributionIds(input: {
  organizationId: string;
  body: InternalAiGatewayRequest;
}): Promise<GatewayAttributionResolutionResult> {
  const { body, organizationId } = input;

  const [employee, client, project, workflowType] = await Promise.all([
    body.employeeExternalId
      ? db.employee.findFirst({
          where: { organizationId, externalId: body.employeeExternalId },
          select: { id: true },
        })
      : Promise.resolve(null),
    body.clientExternalId
      ? db.client.findFirst({
          where: { organizationId, externalId: body.clientExternalId },
          select: { id: true },
        })
      : Promise.resolve(null),
    body.projectExternalId
      ? db.project.findFirst({
          where: { organizationId, externalId: body.projectExternalId },
          select: { id: true },
        })
      : Promise.resolve(null),
    body.workflowExternalId
      ? db.workflowType.findFirst({
          where: { organizationId, externalId: body.workflowExternalId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (body.employeeExternalId && !employee) {
    return notFound("EMPLOYEE_NOT_FOUND", "Employee");
  }

  if (body.clientExternalId && !client) {
    return notFound("CLIENT_NOT_FOUND", "Client");
  }

  if (body.projectExternalId && !project) {
    return notFound("PROJECT_NOT_FOUND", "Project");
  }

  if (body.workflowExternalId && !workflowType) {
    return notFound("WORKFLOW_TYPE_NOT_FOUND", "Workflow type");
  }

  return {
    ok: true,
    value: {
      employeeId: body.employeeId ?? employee?.id ?? null,
      clientId: body.clientId ?? client?.id ?? null,
      projectId: body.projectId ?? project?.id ?? null,
      workflowTypeId: body.workflowTypeId ?? workflowType?.id ?? null,
    },
  };
}
