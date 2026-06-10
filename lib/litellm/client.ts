import { env } from "@/lib/env";
import {
  classifySecret,
  combineStatuses,
  type IntegrationStatus,
} from "@/lib/integration-status";

export interface LiteLLMRuntimeConfig {
  status: IntegrationStatus;
  baseUrl: string | undefined;
}

/**
 * Lightweight config inspection only — no network health checks here.
 * "placeholder" means the .env.example dev values are still in use.
 */
export function getLiteLLMRuntimeConfig(): LiteLLMRuntimeConfig {
  const status = combineStatuses(
    env.LITELLM_PROXY_URL ? "configured" : "missing",
    classifySecret(env.LITELLM_MASTER_KEY),
  );

  return {
    status,
    baseUrl: env.LITELLM_PROXY_URL,
  };
}

/**
 * Throws when LiteLLM credentials are absent. Call this from routes/jobs
 * that actually need the proxy, not at module load or app boot.
 * Placeholder values are allowed: they work against a local proxy.
 */
export function assertLiteLLMConfigured(): {
  baseUrl: string;
  masterKey: string;
} {
  if (!env.LITELLM_PROXY_URL || !env.LITELLM_MASTER_KEY) {
    throw new Error(
      "LiteLLM is not configured. Set LITELLM_PROXY_URL and LITELLM_MASTER_KEY in .env.",
    );
  }

  return {
    baseUrl: env.LITELLM_PROXY_URL,
    masterKey: env.LITELLM_MASTER_KEY,
  };
}

export function createLiteLLMHeaders() {
  const { masterKey } = assertLiteLLMConfigured();

  return {
    Authorization: `Bearer ${masterKey}`,
    "Content-Type": "application/json",
  };
}
