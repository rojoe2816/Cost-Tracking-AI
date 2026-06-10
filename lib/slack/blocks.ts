export type SlackBlock = Record<string, unknown>;

export type UnmappedChannelAssignmentInput = {
  clients: Array<{ id: string; name: string }>;
  projectsByClient?: Record<string, Array<{ id: string; name: string }>>;
  originalRequestId: string;
};

type AssignmentMode =
  | "ASSIGN_ONCE"
  | "MAP_CHANNEL"
  | "ASSIGN_INTERNAL"
  | "CANCEL";

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
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*This channel is not mapped to a client/project yet.*\n" +
          "How should this AI usage be assigned?",
      },
    },
  ];

  const clientOptions = input.clients
    .slice(0, MAX_STATIC_SELECT_OPTIONS)
    .map((client) => ({
      text: {
        type: "plain_text",
        text: truncateSlackText(client.name, 75),
        emoji: true,
      },
      value: client.id,
    }));

  if (clientOptions.length > 0) {
    blocks.push({
      type: "input",
      block_id: "client_assignment",
      optional: true,
      label: {
        type: "plain_text",
        text: "Client",
        emoji: true,
      },
      element: {
        type: "static_select",
        action_id: "select_client",
        placeholder: {
          type: "plain_text",
          text: "Choose a client",
          emoji: true,
        },
        options: clientOptions,
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

  if (input.projectsByClient) {
    // Project selection can be added after a client is chosen through Slack
    // interactivity (select_client → update message with project dropdown).
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Project selection will be added after client selection is handled through Slack interactivity._",
        },
      ],
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
          text: "Assign just this once",
          emoji: true,
        },
        action_id: "assign_once",
        value: buildAssignmentButtonValue(input.originalRequestId, "ASSIGN_ONCE"),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Map this channel",
          emoji: true,
        },
        action_id: "map_channel",
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
        action_id: "assign_internal",
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
        action_id: "cancel_assignment",
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

function truncateSlackText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
