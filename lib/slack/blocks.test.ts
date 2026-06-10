import { describe, expect, it } from "vitest";

import { buildUnmappedChannelAssignmentBlocks } from "./blocks";

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
      "This channel is not mapped to a client/project yet.",
    );
    expect(section.text?.text).toContain(
      "How should this AI usage be assigned?",
    );
  });

  it("includes buttons with the exact required action IDs", () => {
    const buttons = getButtonElements(
      buildUnmappedChannelAssignmentBlocks({
        clients: [],
        originalRequestId: REQUEST_ID,
      }),
    );

    expect(buttons.map((button) => button.action_id)).toEqual([
      "assign_once",
      "map_channel",
      "assign_internal",
      "cancel_assignment",
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
      { action_id: "assign_once", mode: "ASSIGN_ONCE" },
      { action_id: "map_channel", mode: "MAP_CHANNEL" },
      { action_id: "assign_internal", mode: "ASSIGN_INTERNAL" },
      { action_id: "cancel_assignment", mode: "CANCEL" },
    ]);
  });

  it("does not import or call database code", async () => {
    const blocksModule = await import("./blocks");

    expect(Object.keys(blocksModule)).toEqual([
      "buildUnmappedChannelAssignmentBlocks",
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

    expect(inputBlock?.element?.action_id).toBe("select_client");
    expect(inputBlock?.element?.options?.map((option) => option.value)).toEqual([
      "client_1",
      "client_2",
    ]);
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

  it("adds a project selection note when projectsByClient is provided", () => {
    const blocks = buildUnmappedChannelAssignmentBlocks({
      clients: [{ id: "client_1", name: "Acme Dental" }],
      projectsByClient: {
        client_1: [{ id: "project_1", name: "SEO Retainer" }],
      },
      originalRequestId: REQUEST_ID,
    });

    expect(
      blocks.some(
        (block) =>
          block.type === "context" &&
          JSON.stringify(block).includes("Project selection will be added"),
      ),
    ).toBe(true);
  });
});
