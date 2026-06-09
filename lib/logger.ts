import pino from "pino";

import { env } from "@/lib/env";

export const logger = pino({
  name: "cost-tracking-ai",
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "databaseUrl",
      "litellmMasterKey",
      "slackBotToken",
      "slackSigningSecret",
    ],
    censor: "[REDACTED]",
  },
});
