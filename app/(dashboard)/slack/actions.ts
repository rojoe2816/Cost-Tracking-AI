"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createManualSlackChannelMapping,
  deleteManualSlackChannelMapping,
  SlackMappingError,
  updateManualSlackChannelMapping,
} from "@/lib/slack/mappings";
import { assertAdminSession } from "@/lib/auth/session";
import { disconnectSlackWorkspace } from "@/lib/slack/workspace";

function parseRequiredId(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SlackMappingError(`${label} is required`);
  }

  return value.trim();
}

function parseOptionalName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

async function requireOrganizationId(): Promise<string> {
  return (await assertAdminSession()).organizationId;
}

export async function createSlackMappingAction(formData: FormData) {
  try {
    const organizationId = await requireOrganizationId();

    await createManualSlackChannelMapping({
      organizationId,
      slackChannelId: parseRequiredId(formData.get("slackChannelId"), "Slack channel ID"),
      slackChannelName: parseOptionalName(formData.get("slackChannelName")),
      clientId: parseRequiredId(formData.get("clientId"), "Client"),
      projectId: parseRequiredId(formData.get("projectId"), "Project"),
      workflowTypeId: parseRequiredId(formData.get("workflowTypeId"), "Workflow type"),
    });

    revalidatePath("/slack");
    redirect("/slack?notice=created");
  } catch (error) {
    if (error instanceof SlackMappingError) {
      redirect(`/slack?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function updateSlackMappingAction(formData: FormData) {
  try {
    const organizationId = await requireOrganizationId();

    await updateManualSlackChannelMapping({
      organizationId,
      mappingId: parseRequiredId(formData.get("mappingId"), "Mapping"),
      slackChannelId: parseRequiredId(formData.get("slackChannelId"), "Slack channel ID"),
      slackChannelName: parseOptionalName(formData.get("slackChannelName")),
      clientId: parseRequiredId(formData.get("clientId"), "Client"),
      projectId: parseRequiredId(formData.get("projectId"), "Project"),
      workflowTypeId: parseRequiredId(formData.get("workflowTypeId"), "Workflow type"),
    });

    revalidatePath("/slack");
    redirect("/slack?notice=updated");
  } catch (error) {
    if (error instanceof SlackMappingError) {
      redirect(`/slack?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function deleteSlackMappingAction(formData: FormData) {
  try {
    const organizationId = await requireOrganizationId();

    await deleteManualSlackChannelMapping({
      organizationId,
      mappingId: parseRequiredId(formData.get("mappingId"), "Mapping"),
    });

    revalidatePath("/slack");
    redirect("/slack?notice=deleted");
  } catch (error) {
    if (error instanceof SlackMappingError) {
      redirect(`/slack?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function disconnectSlackWorkspaceAction() {
  try {
    const organizationId = await requireOrganizationId();

    await disconnectSlackWorkspace(organizationId);

    revalidatePath("/slack");
    redirect("/slack?notice=slack-disconnected");
  } catch (error) {
    if (error instanceof SlackMappingError) {
      redirect(`/slack?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}
