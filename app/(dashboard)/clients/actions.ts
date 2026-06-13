"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearClientRevenueForOrganization,
  ClientRevenueWorkflowError,
  isRevenueMonth,
  upsertClientRevenueForOrganization,
  type ClientRevenueErrorCode,
  type ClientRevenueMutationNotice,
} from "@/lib/clients/revenue";
import { getDemoOrganization } from "@/lib/slack/mappings";

function parseRequiredString(
  value: FormDataEntryValue | null,
  label: string,
  code: ClientRevenueErrorCode,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ClientRevenueWorkflowError(code, `${label} is required`);
  }

  return value.trim();
}

function safeMonthFromForm(formData: FormData): string | null {
  const month = formData.get("month");
  return isRevenueMonth(month) ? month : null;
}

function redirectToClients(input: {
  month?: string | null;
  notice?: ClientRevenueMutationNotice;
  error?: ClientRevenueErrorCode;
}): never {
  const params = new URLSearchParams();

  if (input.month) {
    params.set("month", input.month);
  }

  if (input.notice) {
    params.set("notice", input.notice);
  }

  if (input.error) {
    params.set("error", input.error);
  }

  const queryString = params.toString();
  redirect(queryString ? `/clients?${queryString}` : "/clients");
}

async function requireDemoOrganizationId(): Promise<string> {
  const organization = await getDemoOrganization();

  if (!organization) {
    throw new ClientRevenueWorkflowError(
      "organization-not-found",
      "Demo Agency organization not found",
    );
  }

  return organization.id;
}

export async function upsertClientRevenueAction(formData: FormData) {
  const month = safeMonthFromForm(formData);

  try {
    const organizationId = await requireDemoOrganizationId();
    const estimatedLaborCostUsd = formData.get("estimatedLaborCostUsd");

    const result = await upsertClientRevenueForOrganization({
      organizationId,
      clientId: parseRequiredString(
        formData.get("clientId"),
        "Client",
        "client-not-found",
      ),
      month: parseRequiredString(formData.get("month"), "Month", "invalid-month"),
      revenueUsd: parseRequiredString(
        formData.get("revenueUsd"),
        "Revenue",
        "revenue-required",
      ),
      estimatedLaborCostUsd:
        typeof estimatedLaborCostUsd === "string" ? estimatedLaborCostUsd : null,
    });

    revalidatePath("/clients");
    redirectToClients({
      month,
      notice: result === "created" ? "revenue-created" : "revenue-updated",
    });
  } catch (error) {
    if (error instanceof ClientRevenueWorkflowError) {
      redirectToClients({ month, error: error.code });
    }

    throw error;
  }
}

export async function clearClientRevenueAction(formData: FormData) {
  const month = safeMonthFromForm(formData);

  try {
    const organizationId = await requireDemoOrganizationId();
    await clearClientRevenueForOrganization({
      organizationId,
      clientId: parseRequiredString(
        formData.get("clientId"),
        "Client",
        "client-not-found",
      ),
      month: parseRequiredString(formData.get("month"), "Month", "invalid-month"),
    });

    revalidatePath("/clients");
    redirectToClients({
      month,
      notice: "revenue-cleared",
    });
  } catch (error) {
    if (error instanceof ClientRevenueWorkflowError) {
      redirectToClients({ month, error: error.code });
    }

    throw error;
  }
}
