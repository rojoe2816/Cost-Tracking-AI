import "server-only";

import Decimal from "decimal.js";

import { db } from "@/lib/db";

export type ClientRevenueMutationNotice =
  | "revenue-created"
  | "revenue-updated"
  | "revenue-cleared";

export type ClientRevenueErrorCode =
  | "organization-not-found"
  | "client-not-found"
  | "invalid-month"
  | "invalid-revenue"
  | "invalid-labor"
  | "negative-revenue"
  | "negative-labor"
  | "revenue-required"
  | "revenue-not-found";

export class ClientRevenueWorkflowError extends Error {
  constructor(
    readonly code: ClientRevenueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClientRevenueWorkflowError";
  }
}

export function isRevenueMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parseRevenueMonth(value: string): string {
  if (!isRevenueMonth(value)) {
    throw new ClientRevenueWorkflowError(
      "invalid-month",
      "Month must use YYYY-MM format",
    );
  }

  return value;
}

function parseUsdValue(input: {
  value: string | null | undefined;
  required: boolean;
  requiredCode: ClientRevenueErrorCode;
  invalidCode: ClientRevenueErrorCode;
  negativeCode: ClientRevenueErrorCode;
  label: string;
}): string | null {
  if (input.value == null || !input.value.trim()) {
    if (input.required) {
      throw new ClientRevenueWorkflowError(
        input.requiredCode,
        `${input.label} is required`,
      );
    }

    return null;
  }

  let parsed: Decimal;

  try {
    parsed = new Decimal(input.value.trim());
  } catch {
    throw new ClientRevenueWorkflowError(
      input.invalidCode,
      `${input.label} must be a valid number`,
    );
  }

  if (!parsed.isFinite()) {
    throw new ClientRevenueWorkflowError(
      input.invalidCode,
      `${input.label} must be a valid number`,
    );
  }

  if (parsed.isNegative()) {
    throw new ClientRevenueWorkflowError(
      input.negativeCode,
      `${input.label} cannot be negative`,
    );
  }

  return parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

async function assertClientBelongsToOrganization(
  tx: {
    client: {
      findFirst: (args: {
        where: { id: string; organizationId: string };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  input: {
    organizationId: string;
    clientId: string;
  },
) {
  const client = await tx.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
    },
    select: { id: true },
  });

  if (!client) {
    throw new ClientRevenueWorkflowError(
      "client-not-found",
      "Client does not belong to this organization",
    );
  }
}

export async function upsertClientRevenueForOrganization(input: {
  organizationId: string;
  clientId: string;
  month: string;
  revenueUsd: string;
  estimatedLaborCostUsd?: string | null;
}): Promise<"created" | "updated"> {
  const month = parseRevenueMonth(input.month);
  const revenueUsd = parseUsdValue({
    value: input.revenueUsd,
    required: true,
    requiredCode: "revenue-required",
    invalidCode: "invalid-revenue",
    negativeCode: "negative-revenue",
    label: "Revenue",
  });
  const estimatedLaborCostUsd = parseUsdValue({
    value: input.estimatedLaborCostUsd,
    required: false,
    requiredCode: "invalid-labor",
    invalidCode: "invalid-labor",
    negativeCode: "negative-labor",
    label: "Estimated labor cost",
  });

  if (revenueUsd == null) {
    throw new ClientRevenueWorkflowError(
      "revenue-required",
      "Revenue is required",
    );
  }

  return db.$transaction(async (tx) => {
    await assertClientBelongsToOrganization(tx, input);

    const existingRevenue = await tx.clientRevenue.findFirst({
      where: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        projectId: null,
        month,
      },
      select: { id: true },
    });

    if (existingRevenue) {
      await tx.clientRevenue.update({
        where: { id: existingRevenue.id },
        data: {
          revenueUsd,
          estimatedLaborCostUsd,
        },
      });
      return "updated";
    }

    await tx.clientRevenue.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        projectId: null,
        month,
        revenueUsd,
        estimatedLaborCostUsd,
      },
    });

    return "created";
  });
}

export async function clearClientRevenueForOrganization(input: {
  organizationId: string;
  clientId: string;
  month: string;
}): Promise<"cleared"> {
  const month = parseRevenueMonth(input.month);

  return db.$transaction(async (tx) => {
    await assertClientBelongsToOrganization(tx, input);

    const existingRevenue = await tx.clientRevenue.findFirst({
      where: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        projectId: null,
        month,
      },
      select: { id: true },
    });

    if (!existingRevenue) {
      throw new ClientRevenueWorkflowError(
        "revenue-not-found",
        "Revenue row not found",
      );
    }

    await tx.clientRevenue.delete({
      where: { id: existingRevenue.id },
    });

    return "cleared" as const;
  });
}
