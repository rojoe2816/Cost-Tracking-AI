import crypto from "node:crypto";

export interface SimulateSlackEventOptions {
  team: string;
  channel: string;
  user: string;
  text: string;
  event: string;
  url: string;
}

export const DEFAULT_SIMULATE_SLACK_OPTIONS: SimulateSlackEventOptions = {
  team: "T_DEMO",
  channel: "C_ACME",
  user: "U_DEMO",
  event: "app_mention",
  url: "http://localhost:3000/api/slack/events",
  text: "@YourBot draft a client update",
};

export function parseCliArgs(
  argv: readonly string[],
): SimulateSlackEventOptions {
  const options: SimulateSlackEventOptions = {
    ...DEFAULT_SIMULATE_SLACK_OPTIONS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    switch (arg) {
      case "--team":
        if (value) {
          options.team = value;
          index += 1;
        }
        break;
      case "--channel":
        if (value) {
          options.channel = value;
          index += 1;
        }
        break;
      case "--user":
        if (value) {
          options.user = value;
          index += 1;
        }
        break;
      case "--text":
        if (value) {
          options.text = value;
          index += 1;
        }
        break;
      case "--event":
        if (value) {
          options.event = value;
          index += 1;
        }
        break;
      case "--url":
        if (value) {
          options.url = value;
          index += 1;
        }
        break;
      default:
        break;
    }
  }

  return options;
}

export function generateSlackMessageTs(now = Date.now()): string {
  return `${Math.floor(now / 1000)}.${String(now % 1_000_000).padStart(6, "0")}`;
}

export function buildSlackEventPayload(input: {
  team: string;
  channel: string;
  user: string;
  text: string;
  eventType: string;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const messageTs = generateSlackMessageTs(now);

  return {
    token: "deprecated-verification-token-not-used",
    team_id: input.team,
    api_app_id: "A_DEMO",
    type: "event_callback",
    event_id: `Ev_${now}`,
    event_time: Math.floor(now / 1000),
    authorizations: [
      {
        enterprise_id: null,
        team_id: input.team,
        user_id: "B_DEMO",
        is_bot: true,
        is_enterprise_install: false,
      },
    ],
    event: {
      type: input.eventType,
      user: input.user,
      text: input.text,
      ts: messageTs,
      channel: input.channel,
      event_ts: messageTs,
    },
  };
}

export function signSlackRequest(input: {
  rawBody: string;
  timestamp: string;
  signingSecret: string;
}): string {
  return `v0=${crypto
    .createHmac("sha256", input.signingSecret)
    .update(`v0:${input.timestamp}:${input.rawBody}`, "utf8")
    .digest("hex")}`;
}

export interface SimulateSlackEventResult {
  options: SimulateSlackEventOptions;
  payload: ReturnType<typeof buildSlackEventPayload>;
  rawBody: string;
  timestamp: string;
  signature: string;
  responseStatus: number;
  responseBody: string;
  elapsedMs: number;
}

export async function simulateSlackEvent(input: {
  options: SimulateSlackEventOptions;
  signingSecret: string;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<SimulateSlackEventResult> {
  const now = input.now ?? Date.now();
  const payload = buildSlackEventPayload({
    team: input.options.team,
    channel: input.options.channel,
    user: input.options.user,
    text: input.options.text,
    eventType: input.options.event,
    now,
  });
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(now / 1000).toString();
  const signature = signSlackRequest({
    rawBody,
    timestamp,
    signingSecret: input.signingSecret,
  });

  const startedAt = performance.now();
  const response = await (input.fetchImpl ?? fetch)(input.options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": timestamp,
    },
    body: rawBody,
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const responseBody = await response.text();

  return {
    options: input.options,
    payload,
    rawBody,
    timestamp,
    signature,
    responseStatus: response.status,
    responseBody,
    elapsedMs,
  };
}

export function formatSimulationSummary(result: SimulateSlackEventResult): string {
  return [
    `requestUrl: ${result.options.url}`,
    `teamId: ${result.options.team}`,
    `channelId: ${result.options.channel}`,
    `eventType: ${result.options.event}`,
    `textLength: ${result.options.text.length}`,
    `responseStatus: ${result.responseStatus}`,
    `responseBody: ${result.responseBody}`,
    `elapsedMs: ${result.elapsedMs}`,
  ].join("\n");
}
