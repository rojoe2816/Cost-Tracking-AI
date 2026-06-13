// Provides dev/test environment defaults so modules that validate
// process.env at import time (lib/env.ts) can load inside vitest.
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/cost_tracking_ai_test";
process.env.ENCRYPTION_KEY ??= "test-only-encryption-key-32-chars!!";
process.env.LITELLM_PROXY_URL ??= "http://localhost:4000";
process.env.LITELLM_MASTER_KEY ??= "sk-test-litellm-master-key";
process.env.LITELLM_DEFAULT_MODEL ??= "gpt-4o-mini";
process.env.LITELLM_REQUEST_TIMEOUT_MS ??= "30000";
process.env.SLACK_BOT_TOKEN ??= "xoxb-test-token";
process.env.SLACK_SIGNING_SECRET ??= "test-signing-secret";
process.env.QUEUE_ADAPTER ??= "in-memory";
process.env.LOG_LEVEL ??= "silent";
