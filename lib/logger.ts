import pino from "pino";

import { env } from "@/lib/env";

export const logger = pino({
  name: "cost-tracking-ai",
  level: env.LOG_LEVEL,
  redact: {
    // Broad redaction so Slack payloads, LiteLLM responses, and provider
    // errors can be logged without leaking credentials.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.authorization",
      "*.cookie",
      "*.apiKey",
      "*.api_key",
      "*.token",
      "*.secret",
      "*.password",
      "databaseUrl",
      "litellmMasterKey",
      "slackBotToken",
      "slackSigningSecret",
    ],
    censor: "[REDACTED]",
  },
});
