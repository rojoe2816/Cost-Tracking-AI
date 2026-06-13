export type SlackBlock = Record<string, unknown>;

export const SLACK_ASSIGNMENT_ACTION_IDS = {
  selectClient: "assignment_select_client",
  selectProject: "assignment_select_project",
  selectWorkflow: "assignment_select_workflow",
  assignOnce: "assignment_assign_once",
  mapChannel: "assignment_map_channel",
  assignInternal: "assignment_internal",
  cancel: "assignment_cancel",
} as const;

export type UnmappedChannelAssignmentInput = {
  clients: Array<{ id: string; name: string }>;
  projects?: Array<{
    id: string;
    name: string;
    clientId: string;
    clientName?: string | null;
  }>;
  projectsByClient?: Record<string, Array<{ id: string; name: string }>>;
  workflowTypes?: Array<{ id: string; name: string }>;
  originalRequestId: string;
  slackTeamId?: string | null;
  slackChannelId?: string | null;
  slackChannelName?: string | null;
  selectedClientId?: string | null;
  selectedProjectId?: string | null;
  selectedWorkflowTypeId?: string | null;
  validationMessage?: string | null;
};

type AssignmentMode =
  | "ASSIGN_ONCE"
  | "MAP_CHANNEL"
  | "ASSIGN_INTERNAL"
  | "CANCEL";

type AssignmentSelectKind = "CLIENT" | "PROJECT" | "WORKFLOW";

const MAX_STATIC_SELECT_OPTIONS = 100;

/**
 * Builds Slack Block Kit UI for assigning AI usage from an unmapped channel.
 *
 * This function only returns Block Kit JSON — it does not persist mappings,
 * call Prisma, call LiteLLM, or post to Slack. Only the later `map_channel`
 * interactivity handler should call `createOrUpdateSlackChannelMapping` with
 * mode `MAP_CHANNEL`.
 */
export function buildUnmappedChannelAssignmentBlocks(
  input: UnmappedChannelAssignmentInput,
): SlackBlock[] {
  const projects = normalizeProjects(input);
  const selectedClient = input.clients.find(
    (client) => client.id === input.selectedClientId,
  );
  const selectedWorkflow = input.workflowTypes?.find(
    (workflowType) => workflowType.id === input.selectedWorkflowTypeId,
  );
  const filteredProjects = input.selectedClientId
    ? projects.filter((project) => project.clientId === input.selectedClientId)
    : projects;
  const selectedProject = filteredProjects.find(
    (project) => project.id === input.selectedProjectId,
  );

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Slate needs attribution before this AI request can be processed.*\n" +
          "Choose a client, project, and workflow type, then decide whether this is a one-time assignment or the default for this channel.",
      },
    },
  ];

  const contextParts = [
    input.slackTeamId ? `Workspace: \`${input.slackTeamId}\`` : null,
    input.slackChannelName
      ? `Channel: #${input.slackChannelName}`
      : input.slackChannelId
        ? `Channel: \`${input.slackChannelId}\``
        : null,
  ].filter(Boolean);

  if (contextParts.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: contextParts.join("  |  "),
        },
      ],
    });
  }

  if (input.validationMessage) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: ${input.validationMessage}`,
      },
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: [
        `*Selected client:* ${selectedClient?.name ?? "_None selected_"}`,
        `*Selected project:* ${selectedProject?.name ?? "_None selected_"}`,
        `*Selected workflow:* ${selectedWorkflow?.name ?? "_None selected_"}`,
      ].join("\n"),
    },
  });

  const clientOptions = input.clients
    .slice(0, MAX_STATIC_SELECT_OPTIONS)
    .map((client) =>
      buildSelectOption({
        originalRequestId: input.originalRequestId,
        kind: "CLIENT",
        entityId: client.id,
        label: client.name,
      }),
    );

  if (clientOptions.length > 0) {
    const selectedClientOption = clientOptions.find(
      (option) =>
        parseAssignmentSelectValue(option.value).value?.entityId ===
        input.selectedClientId,
    );

    blocks.push({
      type: "input",
      block_id: "assignment_client",
      optional: true,
      label: {
        type: "plain_text",
        text: "Client",
        emoji: true,
      },
      element: {
        type: "static_select",
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.selectClient,
        placeholder: {
          type: "plain_text",
          text: "Choose a client",
          emoji: true,
        },
        options: clientOptions,
        ...(selectedClientOption ? { initial_option: selectedClientOption } : {}),
      },
    });
  }

  if (input.clients.length > MAX_STATIC_SELECT_OPTIONS) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Showing the first ${MAX_STATIC_SELECT_OPTIONS} clients. Refine client search support can be added later._`,
        },
      ],
    });
  }

  const projectOptions = filteredProjects
    .slice(0, MAX_STATIC_SELECT_OPTIONS)
    .map((project) =>
      buildSelectOption({
        originalRequestId: input.originalRequestId,
        kind: "PROJECT",
        entityId: project.id,
        label:
          input.selectedClientId || !project.clientName
            ? project.name
            : `${project.clientName} - ${project.name}`,
      }),
    );

  if (projectOptions.length > 0) {
    const selectedProjectOption = projectOptions.find(
      (option) =>
        parseAssignmentSelectValue(option.value).value?.entityId ===
        input.selectedProjectId,
    );

    blocks.push({
      type: "input",
      block_id: "assignment_project",
      optional: true,
      label: {
        type: "plain_text",
        text: input.selectedClientId ? "Project" : "Project (choose client first)",
        emoji: true,
      },
      element: {
        type: "static_select",
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.selectProject,
        placeholder: {
          type: "plain_text",
          text: input.selectedClientId ? "Choose a project" : "Choose a client first",
          emoji: true,
        },
        options: projectOptions,
        ...(selectedProjectOption ? { initial_option: selectedProjectOption } : {}),
      },
    });
  } else if (input.selectedClientId) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_No active projects were found for the selected client. You can still assign the request to the client._",
        },
      ],
    });
  }

  if (projects.length > MAX_STATIC_SELECT_OPTIONS) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Showing the first ${MAX_STATIC_SELECT_OPTIONS} matching projects._`,
        },
      ],
    });
  }

  const workflowOptions = (input.workflowTypes ?? [])
    .slice(0, MAX_STATIC_SELECT_OPTIONS)
    .map((workflowType) =>
      buildSelectOption({
        originalRequestId: input.originalRequestId,
        kind: "WORKFLOW",
        entityId: workflowType.id,
        label: workflowType.name,
      }),
    );

  if (workflowOptions.length > 0) {
    const selectedWorkflowOption = workflowOptions.find(
      (option) =>
        parseAssignmentSelectValue(option.value).value?.entityId ===
        input.selectedWorkflowTypeId,
    );

    blocks.push({
      type: "input",
      block_id: "assignment_workflow",
      optional: true,
      label: {
        type: "plain_text",
        text: "Workflow type",
        emoji: true,
      },
      element: {
        type: "static_select",
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.selectWorkflow,
        placeholder: {
          type: "plain_text",
          text: "Choose a workflow type",
          emoji: true,
        },
        options: workflowOptions,
        ...(selectedWorkflowOption
          ? { initial_option: selectedWorkflowOption }
          : {}),
      },
    });
  }

  blocks.push({
    type: "actions",
    block_id: "unmapped_channel_assignment_actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Assign once",
          emoji: true,
        },
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.assignOnce,
        value: buildAssignmentButtonValue(input.originalRequestId, "ASSIGN_ONCE"),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Map this channel",
          emoji: true,
        },
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.mapChannel,
        style: "primary",
        value: buildAssignmentButtonValue(input.originalRequestId, "MAP_CHANNEL"),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Internal / No client",
          emoji: true,
        },
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.assignInternal,
        value: buildAssignmentButtonValue(
          input.originalRequestId,
          "ASSIGN_INTERNAL",
        ),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Cancel",
          emoji: true,
        },
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.cancel,
        style: "danger",
        value: buildAssignmentButtonValue(input.originalRequestId, "CANCEL"),
      },
    ],
  });

  return blocks;
}

function buildAssignmentButtonValue(
  originalRequestId: string,
  mode: AssignmentMode,
): string {
  return JSON.stringify({
    originalRequestId,
    mode,
  });
}

function buildSelectOption(input: {
  originalRequestId: string;
  kind: AssignmentSelectKind;
  entityId: string;
  label: string;
}) {
  return {
    text: {
      type: "plain_text",
      text: truncateSlackText(input.label, 75),
      emoji: true,
    },
    value: JSON.stringify({
      originalRequestId: input.originalRequestId,
      kind: input.kind,
      entityId: input.entityId,
    }),
  };
}

function normalizeProjects(input: UnmappedChannelAssignmentInput) {
  if (input.projects) {
    return input.projects;
  }

  if (!input.projectsByClient) {
    return [];
  }

  return Object.entries(input.projectsByClient).flatMap(([clientId, projects]) =>
    projects.map((project) => ({
      ...project,
      clientId,
      clientName: input.clients.find((client) => client.id === clientId)?.name ?? null,
    })),
  );
}

export function parseAssignmentSelectValue(value: unknown):
  | {
      ok: true;
      value: {
        originalRequestId: string;
        kind: AssignmentSelectKind;
        entityId: string;
      };
    }
  | { ok: false; value: null } {
  if (typeof value !== "string") {
    return { ok: false, value: null };
  }

  try {
    const parsed = JSON.parse(value) as Partial<{
      originalRequestId: string;
      kind: AssignmentSelectKind;
      entityId: string;
    }>;

    if (
      typeof parsed.originalRequestId === "string" &&
      isAssignmentSelectKind(parsed.kind) &&
      typeof parsed.entityId === "string" &&
      parsed.entityId.trim()
    ) {
      return {
        ok: true,
        value: {
          originalRequestId: parsed.originalRequestId,
          kind: parsed.kind,
          entityId: parsed.entityId,
        },
      };
    }
  } catch {
    // Older tests and payloads used raw entity IDs. Callers can still fall back
    // to the original string when they know the field they are reading.
  }

  return { ok: false, value: null };
}

function isAssignmentSelectKind(
  value: unknown,
): value is AssignmentSelectKind {
  return value === "CLIENT" || value === "PROJECT" || value === "WORKFLOW";
}

function truncateSlackText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
