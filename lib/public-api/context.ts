import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { slugify } from "@/lib/demo-agency";
import type { SourceAppAuthContext } from "@/lib/internal-ai/sourceAppAuth";

import { getOrganizationModelOptions } from "./modelAccess";

const externalId = z.string().trim().min(1).max(128);

export const employeeSyncSchema = z.object({
  employees: z
    .array(
      z
        .object({
          externalId,
          name: z.string().trim().min(1).max(160),
          email: z.string().trim().email().max(320).optional().nullable(),
          department: z.string().trim().max(160).optional().nullable(),
          role: z.string().trim().max(160).optional().nullable(),
          isActive: z.boolean().optional(),
        })
        .strict(),
    )
    .min(1)
    .max(100),
});

export const clientSyncSchema = z.object({
  clients: z
    .array(
      z
        .object({
          externalId,
          name: z.string().trim().min(1).max(160),
          isActive: z.boolean().optional(),
        })
        .strict(),
    )
    .min(1)
    .max(100),
});

export const projectSyncSchema = z.object({
  projects: z
    .array(
      z
        .object({
          externalId,
          clientExternalId: externalId,
          name: z.string().trim().min(1).max(160),
          isActive: z.boolean().optional(),
        })
        .strict(),
    )
    .min(1)
    .max(100),
});

export const workflowSyncSchema = z.object({
  workflows: z
    .array(
      z
        .object({
          externalId,
          name: z.string().trim().min(1).max(160),
        })
        .strict(),
    )
    .min(1)
    .max(100),
});

export type ContextSyncResult =
  | { ok: true; count: number }
  | { ok: false; code: string; message: string };

export async function getPublicContext(auth: SourceAppAuthContext) {
  const [organization, employees, clients, projects, workflows, models] =
    await Promise.all([
      db.organization.findUnique({
        where: { id: auth.organizationId },
        select: { name: true },
      }),
      db.employee.findMany({
        where: {
          organizationId: auth.organizationId,
          isActive: true,
          externalId: { not: null },
        },
        orderBy: { name: "asc" },
        select: {
          externalId: true,
          name: true,
          email: true,
          department: true,
          role: true,
        },
      }),
      db.client.findMany({
        where: {
          organizationId: auth.organizationId,
          status: "ACTIVE",
          externalId: { not: null },
        },
        orderBy: { name: "asc" },
        select: { externalId: true, name: true },
      }),
      db.project.findMany({
        where: {
          organizationId: auth.organizationId,
          status: "ACTIVE",
          externalId: { not: null },
          client: { externalId: { not: null } },
        },
        orderBy: { name: "asc" },
        select: {
          externalId: true,
          name: true,
          client: { select: { externalId: true } },
        },
      }),
      db.workflowType.findMany({
        where: {
          organizationId: auth.organizationId,
          externalId: { not: null },
        },
        orderBy: { name: "asc" },
        select: { externalId: true, name: true },
      }),
      getOrganizationModelOptions(auth.organizationId),
    ]);

  return {
    organization: { name: organization?.name ?? "Organization" },
    sourceApp: { name: auth.sourceAppName, type: auth.sourceAppType },
    employees: employees.flatMap((employee) =>
      employee.externalId ? [{ ...employee, externalId: employee.externalId }] : [],
    ),
    clients: clients.flatMap((client) =>
      client.externalId ? [{ ...client, externalId: client.externalId }] : [],
    ),
    projects: projects.flatMap((project) =>
      project.externalId && project.client.externalId
        ? [
            {
              externalId: project.externalId,
              clientExternalId: project.client.externalId,
              name: project.name,
            },
          ]
        : [],
    ),
    workflows: workflows.flatMap((workflow) =>
      workflow.externalId ? [{ ...workflow, externalId: workflow.externalId }] : [],
    ),
    models,
  };
}

export async function syncEmployees(
  organizationId: string,
  body: unknown,
): Promise<ContextSyncResult> {
  const parsed = employeeSyncSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_BODY", message: parsed.error.issues[0]?.message ?? "Invalid employees." };
  }

  await db.$transaction(
    parsed.data.employees.map((employee) =>
      db.employee.upsert({
        where: {
          organizationId_externalId: {
            organizationId,
            externalId: employee.externalId,
          },
        },
        update: {
          name: employee.name,
          email: employee.email ?? null,
          department: employee.department ?? null,
          role: employee.role ?? null,
          isActive: employee.isActive ?? true,
        },
        create: {
          organizationId,
          externalId: employee.externalId,
          name: employee.name,
          email: employee.email ?? null,
          department: employee.department ?? null,
          role: employee.role ?? null,
          isActive: employee.isActive ?? true,
        },
      }),
    ),
  );

  return { ok: true, count: parsed.data.employees.length };
}

export async function syncClients(
  organizationId: string,
  body: unknown,
): Promise<ContextSyncResult> {
  const parsed = clientSyncSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_BODY", message: parsed.error.issues[0]?.message ?? "Invalid clients." };
  }

  await db.$transaction(
    parsed.data.clients.map((client) =>
      db.client.upsert({
        where: {
          organizationId_externalId: {
            organizationId,
            externalId: client.externalId,
          },
        },
        update: {
          name: client.name,
          status: client.isActive === false ? "ARCHIVED" : "ACTIVE",
        },
        create: {
          organizationId,
          externalId: client.externalId,
          name: client.name,
          status: client.isActive === false ? "ARCHIVED" : "ACTIVE",
        },
      }),
    ),
  );

  return { ok: true, count: parsed.data.clients.length };
}

export async function syncProjects(
  organizationId: string,
  body: unknown,
): Promise<ContextSyncResult> {
  const parsed = projectSyncSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_BODY", message: parsed.error.issues[0]?.message ?? "Invalid projects." };
  }

  const clientExternalIds = [
    ...new Set(parsed.data.projects.map((project) => project.clientExternalId)),
  ];
  const clients = await db.client.findMany({
    where: { organizationId, externalId: { in: clientExternalIds } },
    select: { id: true, externalId: true },
  });
  const clientsByExternalId = new Map(
    clients.flatMap((client) =>
      client.externalId ? [[client.externalId, client.id] as const] : [],
    ),
  );
  const missingClient = clientExternalIds.find(
    (clientExternalId) => !clientsByExternalId.has(clientExternalId),
  );

  if (missingClient) {
    return {
      ok: false,
      code: "CLIENT_NOT_FOUND",
      message: `Client ${missingClient} was not found for this organization.`,
    };
  }

  await db.$transaction(
    parsed.data.projects.map((project) =>
      db.project.upsert({
        where: {
          organizationId_externalId: {
            organizationId,
            externalId: project.externalId,
          },
        },
        update: {
          clientId: clientsByExternalId.get(project.clientExternalId)!,
          name: project.name,
          status: project.isActive === false ? "ARCHIVED" : "ACTIVE",
        },
        create: {
          organizationId,
          externalId: project.externalId,
          clientId: clientsByExternalId.get(project.clientExternalId)!,
          name: project.name,
          status: project.isActive === false ? "ARCHIVED" : "ACTIVE",
        },
      }),
    ),
  );

  return { ok: true, count: parsed.data.projects.length };
}

export async function syncWorkflows(
  organizationId: string,
  body: unknown,
): Promise<ContextSyncResult> {
  const parsed = workflowSyncSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_BODY", message: parsed.error.issues[0]?.message ?? "Invalid workflows." };
  }

  await db.$transaction(
    parsed.data.workflows.map((workflow) =>
      db.workflowType.upsert({
        where: {
          organizationId_externalId: {
            organizationId,
            externalId: workflow.externalId,
          },
        },
        update: {
          name: workflow.name,
          slug: slugify(workflow.externalId),
        },
        create: {
          organizationId,
          externalId: workflow.externalId,
          name: workflow.name,
          slug: slugify(workflow.externalId),
        },
      }),
    ),
  );

  return { ok: true, count: parsed.data.workflows.length };
}
