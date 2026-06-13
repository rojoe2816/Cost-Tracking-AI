"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getDemoOrganization } from "@/lib/slack/mappings";

class ClientRevenueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientRevenueError";
  }
}

function parseRequiredString(
  value: FormDataEntryValue | null,
  label: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ClientRevenueError(`${label} is required`);
  }

  return value.trim();
}

function parseMonth(value: FormDataEntryValue | null): string {
  const month = parseRequiredString(value, "Month");

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ClientRevenueError("Month must use YYYY-MM format");
  }

  return month;
}

function parseUsdValue(
  value: FormDataEntryValue | null,
  label: string,
  options: { required: boolean },
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    if (options.required) {
      throw new ClientRevenueError(`${label} is required`);
    }

    return null;
  }

  let parsed: Decimal;

  try {
    parsed = new Decimal(value.trim());
  } catch {
    throw new ClientRevenueError(`${label} must be a valid number`);
  }

  if (!parsed.isFinite()) {
    throw new ClientRevenueError(`${label} must be a valid number`);
  }

  if (parsed.isNegative()) {
    throw new ClientRevenueError(`${label} cannot be negative`);
  }

  return parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

async function requireDemoOrganizationId(): Promise<string> {
  const organization = await getDemoOrganization();

  if (!organization) {
    throw new ClientRevenueError("Demo Agency organization not found");
  }

  return organization.id;
}

export async function upsertClientRevenueAction(formData: FormData) {
  try {
    const organizationId = await requireDemoOrganizationId();
    const clientId = parseRequiredString(formData.get("clientId"), "Client");
    const month = parseMonth(formData.get("month"));
    const revenueUsd = parseUsdValue(formData.get("revenueUsd"), "Revenue", {
      required: true,
    });
    const estimatedLaborCostUsd = parseUsdValue(
      formData.get("estimatedLaborCostUsd"),
      "Estimated labor cost",
      { required: false },
    );

    if (revenueUsd == null) {
      throw new ClientRevenueError("Revenue is required");
    }

    await db.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: {
          id: clientId,
          organizationId,
        },
        select: { id: true },
      });

      if (!client) {
        throw new ClientRevenueError("Client does not belong to this organization");
      }

      const existingRevenue = await tx.clientRevenue.findFirst({
        where: {
          organizationId,
          clientId,
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
        return;
      }

      await tx.clientRevenue.create({
        data: {
          organizationId,
          clientId,
          projectId: null,
          month,
          revenueUsd,
          estimatedLaborCostUsd,
        },
      });
    });

    revalidatePath("/clients");
    redirect("/clients?notice=revenue-updated");
  } catch (error) {
    if (error instanceof ClientRevenueError) {
      redirect(`/clients?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}
