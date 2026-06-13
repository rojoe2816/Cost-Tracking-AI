import { describe, expect, it } from "vitest";

import {
  buildUnmappedChannelAssignmentBlocks,
  parseAssignmentSelectValue,
  SLACK_ASSIGNMENT_ACTION_IDS,
} from "./blocks";

const REQUEST_ID = "req_test_123";

function getActionsBlock(
  blocks: ReturnType<typeof buildUnmappedChannelAssignmentBlocks>,
) {
  return blocks.find((block) => block.type === "actions");
}

function getButtonElements(
  blocks: ReturnType<typeof buildUnmappedChannelAssignmentBlocks>,
) {
  const actions = getActionsBlock(blocks);
  return (actions?.elements ?? []) as Array<Record<string, unknown>>;
}

describe("buildUnmappedChannelAssignmentBlocks", () => {
  it("includes the main unmapped-channel message", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [],
      originalRequestId: REQUEST_ID,
    });

    const section = blocks[0] as {
      text?: { text?: string };
    };

    expect(section.text?.text).toContain(
      "Slate needs attribution before this AI request can be processed.",
    );
    expect(section.text?.text).toContain("Choose a client, project, and workflow");
  });

  it("includes buttons with the exact required action IDs", () => {
    const buttons = getButtonElements(
      buildUnmappedChannelAssignmentBlocks({
        clients: [],
        originalRequestId: REQUEST_ID,
      }),
    );

    expect(buttons.map((button) => button.action_id)).toEqual([
      SLACK_ASSIGNMENT_ACTION_IDS.assignOnce,
      SLACK_ASSIGNMENT_ACTION_IDS.mapChannel,
      SLACK_ASSIGNMENT_ACTION_IDS.assignInternal,
      SLACK_ASSIGNMENT_ACTION_IDS.cancel,
    ]);
  });

  it("uses MAP_CHANNEL mode only for the persistent map_channel button", () => {
    const buttons = getButtonElements(
      buildUnmappedChannelAssignmentBlocks({
        clients: [],
        originalRequestId: REQUEST_ID,
      }),
    );

    const modes = buttons.map((button) => {
      const value = JSON.parse(String(button.value)) as { mode: string };
      return { action_id: button.action_id, mode: value.mode };
    });

    expect(modes).toEqual([
      {
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.assignOnce,
        mode: "ASSIGN_ONCE",
      },
      {
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.mapChannel,
        mode: "MAP_CHANNEL",
      },
      {
        action_id: SLACK_ASSIGNMENT_ACTION_IDS.assignInternal,
        mode: "ASSIGN_INTERNAL",
      },
      { action_id: SLACK_ASSIGNMENT_ACTION_IDS.cancel, mode: "CANCEL" },
    ]);
  });

  it("does not import or call database code", async () => {
    const blocksModule = await import("./blocks");

    expect(Object.keys(blocksModule).sort()).toEqual([
      "SLACK_ASSIGNMENT_ACTION_IDS",
      "buildUnmappedChannelAssignmentBlocks",
      "parseAssignmentSelectValue",
    ]);
    expect(JSON.stringify(blocksModule)).not.toContain("prisma");
    expect(JSON.stringify(blocksModule)).not.toContain("@/lib/db");
  });

  it("includes client select options when clients are passed", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [
        { id: "client_1", name: "Acme Dental" },
        { id: "client_2", name: "Greenline Roofing" },
      ],
      originalRequestId: REQUEST_ID,
    });

    const inputBlock = blocks.find((block) => block.type === "input") as {
      element?: {
        action_id?: string;
        options?: Array<{ value?: string }>;
      };
    };

    expect(inputBlock?.element?.action_id).toBe(
      SLACK_ASSIGNMENT_ACTION_IDS.selectClient,
    );
    expect(
      inputBlock?.element?.options?.map((option) => {
        const parsed = parseAssignmentSelectValue(option.value);
        return parsed.value?.entityId;
      }),
    ).toEqual(["client_1", "client_2"]);
  });

  it("caps client select options at 100", () => {
    const clients = Array.from({ length: 105 }, (_, index) => ({
      id: `client_${index}`,
      name: `Client ${index}`,
    }));

    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients,
      originalRequestId: REQUEST_ID,
    });

    const inputBlock = blocks.find((block) => block.type === "input") as {
      element?: { options?: unknown[] };
    };

    expect(inputBlock?.element?.options).toHaveLength(100);
    expect(
      blocks.some(
        (block) =>
          block.type === "context" &&
          JSON.stringify(block).includes("first 100 clients"),
      ),
    ).toBe(true);
  });

  it("includes originalRequestId in every button value", () => {
    const buttons = getButtonElements(
      buildUnmappedChannelAssignmentBlocks({
        clients: [],
        originalRequestId: REQUEST_ID,
      }),
    );

    for (const button of buttons) {
      const value = JSON.parse(String(button.value)) as {
        originalRequestId: string;
      };
      expect(value.originalRequestId).toBe(REQUEST_ID);
    }
  });

  it("includes project and workflow selectors", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [{ id: "client_1", name: "Acme Dental" }],
      projects: [
        {
          id: "project_1",
          name: "SEO Retainer",
          clientId: "client_1",
          clientName: "Acme Dental",
        },
      ],
      workflowTypes: [{ id: "workflow_1", name: "Client Update" }],
      originalRequestId: REQUEST_ID,
    });

    const actionIds = blocks
      .filter((block) => block.type === "input")
      .map((block) => {
        const inputBlock = block as { element?: { action_id?: string } };
        return inputBlock.element?.action_id;
      });

    expect(actionIds).toEqual([
      SLACK_ASSIGNMENT_ACTION_IDS.selectClient,
      SLACK_ASSIGNMENT_ACTION_IDS.selectProject,
      SLACK_ASSIGNMENT_ACTION_IDS.selectWorkflow,
    ]);
  });

  it("filters project options after client selection", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [
        { id: "client_1", name: "Acme Dental" },
        { id: "client_2", name: "Greenline Roofing" },
      ],
      projects: [
        {
          id: "project_1",
          name: "SEO Retainer",
          clientId: "client_1",
          clientName: "Acme Dental",
        },
        {
          id: "project_2",
          name: "Ad Campaign",
          clientId: "client_2",
          clientName: "Greenline Roofing",
        },
      ],
      originalRequestId: REQUEST_ID,
      selectedClientId: "client_2",
    });

    const projectBlock = blocks.find((block) =>
      JSON.stringify(block).includes(SLACK_ASSIGNMENT_ACTION_IDS.selectProject),
    ) as {
      element?: { options?: Array<{ value?: string }> };
    };

    expect(
      projectBlock?.element?.options?.map((option) => {
        const parsed = parseAssignmentSelectValue(option.value);
        return parsed.value?.entityId;
      }),
    ).toEqual(["project_2"]);
  });

  it("shows safe workspace and channel context when provided", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [],
      originalRequestId: REQUEST_ID,
      slackTeamId: "T_TEST",
      slackChannelId: "C_TEST",
    });

    expect(JSON.stringify(blocks)).toContain("Workspace: `T_TEST`");
    expect(JSON.stringify(blocks)).toContain("Channel: `C_TEST`");
  });
});
