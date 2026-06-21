import "server-only";

import { z } from "zod";

const requiredString = (name: string) =>
  z
    .string()
    .trim()
    .min(1, `${name} is required`);

const postgresUrl = (name: string) =>
  requiredString(name).refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    `${name} must be a PostgreSQL connection string`,
  );

const optionalPostgresUrl = (name: string) =>
  z
    .string()
    .trim()
    .min(1, `${name} is required`)
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      `${name} must be a PostgreSQL connection string`,
    )
    .optional();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL"),
  DATABASE_URL: postgresUrl("DATABASE_URL"),
  ENCRYPTION_KEY: requiredString("ENCRYPTION_KEY").min(
    32,
    "ENCRYPTION_KEY must be at least 32 characters long",
  ),
  // Integration credentials are optional at boot so the app can start
  // without Slack/LiteLLM configured. Routes and jobs that actually need an
  // integration must call assertLiteLLMConfigured()/assertSlackConfigured()
  // (see lib/litellm/client.ts and lib/slack/client.ts).
  LITELLM_MASTER_KEY: z.string().trim().min(1).optional(),
  LITELLM_PROXY_URL: z
    .string()
    .url("LITELLM_PROXY_URL must be a valid URL")
    .optional(),
  LITELLM_ANALYTICS_DATABASE_URL: optionalPostgresUrl(
    "LITELLM_ANALYTICS_DATABASE_URL",
  ),
  LITELLM_DEFAULT_MODEL: z.string().trim().min(1).optional(),
  LITELLM_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SLACK_BOT_TOKEN: z.string().trim().min(1).optional(),
  SLACK_SIGNING_SECRET: z.string().trim().min(1).optional(),
  SLACK_CLIENT_ID: z.string().trim().min(1).optional(),
  SLACK_CLIENT_SECRET: z.string().trim().min(1).optional(),
  SLACK_REDIRECT_URI: z.string().url("SLACK_REDIRECT_URI must be a valid URL").optional(),
  MOCK_COMPANY_SOURCE_APP_KEY: z.string().trim().min(1).optional(),
  QUEUE_ADAPTER: z.enum(["in-memory", "postgres"]).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Environment validation failed");
}

export const env = parsedEnv.data;
