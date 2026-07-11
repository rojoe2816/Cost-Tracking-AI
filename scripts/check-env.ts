import "dotenv/config";

import { env } from "../lib/env";

console.log("Environment validated successfully.");
console.table({
  NODE_ENV: env.NODE_ENV,
  APP_BASE_URL: env.APP_BASE_URL,
  DATABASE_URL: env.DATABASE_URL ? "configured" : "missing",
  ENCRYPTION_KEY: env.ENCRYPTION_KEY ? "configured" : "missing",
  SESSION_SECRET: env.SESSION_SECRET ? "configured" : "development fallback",
  SLATE_ADMIN_EMAIL: env.SLATE_ADMIN_EMAIL ? "configured" : "missing",
  SLATE_ADMIN_PASSWORD: env.SLATE_ADMIN_PASSWORD ? "configured" : "missing",
  SLATE_ADMIN_ORGANIZATION_SLUG:
    env.SLATE_ADMIN_ORGANIZATION_SLUG ?? "first membership",
  LITELLM_PROXY_URL: env.LITELLM_PROXY_URL,
  LITELLM_MASTER_KEY: env.LITELLM_MASTER_KEY ? "configured" : "missing",
  LITELLM_ANALYTICS_DATABASE_URL: env.LITELLM_ANALYTICS_DATABASE_URL
    ? "configured"
    : "missing",
  SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN ? "configured" : "missing",
  SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET ? "configured" : "missing",
  SLACK_CLIENT_ID: env.SLACK_CLIENT_ID ? "configured" : "missing",
  SLACK_CLIENT_SECRET: env.SLACK_CLIENT_SECRET ? "configured" : "missing",
  SLACK_REDIRECT_URI: env.SLACK_REDIRECT_URI ?? "missing",
  QUEUE_ADAPTER: env.QUEUE_ADAPTER ?? (env.NODE_ENV === "test" ? "in-memory" : "postgres"),
});

if (
  env.NODE_ENV === "production" &&
  (!env.SESSION_SECRET || !env.SLATE_ADMIN_EMAIL || !env.SLATE_ADMIN_PASSWORD)
) {
  throw new Error(
    "Production requires SESSION_SECRET, SLATE_ADMIN_EMAIL, and SLATE_ADMIN_PASSWORD.",
  );
}
