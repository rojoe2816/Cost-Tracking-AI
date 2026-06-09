import "dotenv/config";

import { env } from "../lib/env";

console.log("Environment validated successfully.");
console.table({
  NODE_ENV: env.NODE_ENV,
  APP_BASE_URL: env.APP_BASE_URL,
  DATABASE_URL: env.DATABASE_URL ? "configured" : "missing",
  ENCRYPTION_KEY: env.ENCRYPTION_KEY ? "configured" : "missing",
  LITELLM_PROXY_URL: env.LITELLM_PROXY_URL,
  LITELLM_MASTER_KEY: env.LITELLM_MASTER_KEY ? "configured" : "missing",
  SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN ? "configured" : "missing",
  SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET ? "configured" : "missing",
});
