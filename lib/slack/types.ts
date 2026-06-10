export interface SlackUrlVerificationPayload {
  type: "url_verification";
  challenge: string;
  token?: string;
}

export interface SlackEventBody {
  type?: string;
  subtype?: string;
  bot_id?: string;
  user?: string;
  channel?: string;
  ts?: string;
  text?: string;
}

export interface SlackEventCallbackPayload {
  type: "event_callback";
  team_id?: string;
  api_app_id?: string;
  event_id?: string;
  event_time?: number;
  event?: SlackEventBody;
}

export type SlackEventPayload =
  | SlackUrlVerificationPayload
  | SlackEventCallbackPayload;
